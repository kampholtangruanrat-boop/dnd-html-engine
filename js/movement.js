const SIZE_ORDER = {
    Tiny: 0,
    Small: 1,
    Medium: 2,
    Large: 3,
    Huge: 4,
    Gargantuan: 5
};


function getMapTile(map,x,y){

    if(!map || !Array.isArray(map.tiles)){
        return null;
    }

    return map.tiles.find(tile =>
        tile.x === x && tile.y === y
    ) || null;
}


function isInsideMap(map,x,y){

    return Boolean(
        map &&
        Number.isInteger(x) &&
        Number.isInteger(y) &&
        x >= 1 &&
        y >= 1 &&
        x <= map.width &&
        y <= map.height
    );
}


function isDifficultTerrain(map,x,y){

    const tile =
        getMapTile(map,x,y);

    return Boolean(
        tile && tile.difficult === true
    );
}


function blocksDiagonalCorner(map,x,y){

    if(!isInsideMap(map,x,y)){
        return true;
    }

    const tile =
        getMapTile(map,x,y);

    return Boolean(
        tile &&
        (tile.blocksMovement === true || tile.fillsSpace === true)
    );
}


function getCreatureFootprint(character,x = character.position.x,y = character.position.y){

    const size =
        SIZE_ORDER[character.size];

    let side = 1;

    if(character.size === "Large"){
        side = 2;
    }else if(character.size === "Huge"){
        side = 3;
    }else if(character.size === "Gargantuan"){
        side = 4;
    }

    const squares = [];

    for(let offsetY = 0; offsetY < side; offsetY += 1){
        for(let offsetX = 0; offsetX < side; offsetX += 1){
            squares.push({
                x:x + offsetX,
                y:y + offsetY
            });
        }
    }

    return {
        side: side,
        squares: squares,
        sizeIndex: size
    };
}


function isFootprintInsideMap(map,character,x,y){

    const footprint =
        getCreatureFootprint(character,x,y);

    return footprint.squares.every(square =>
        isInsideMap(map,square.x,square.y)
    );
}


function getMovementPath(character,x,y){

    const path = [];

    let currentX = character.position.x;
    let currentY = character.position.y;

    while(currentX !== x || currentY !== y){

        if(currentX < x){
            currentX += 1;
        }else if(currentX > x){
            currentX -= 1;
        }

        if(currentY < y){
            currentY += 1;
        }else if(currentY > y){
            currentY -= 1;
        }

        path.push({
            x:currentX,
            y:currentY
        });
    }

    return path;
}


function crossesBlockedCorner(map,fromX,fromY,toX,toY,footprintSide = 1){

    const dx = toX - fromX;
    const dy = toY - fromY;

    if(Math.abs(dx) !== 1 || Math.abs(dy) !== 1){
        return false;
    }

    for(let offsetY = 0; offsetY < footprintSide; offsetY += 1){
        for(let offsetX = 0; offsetX < footprintSide; offsetX += 1){

            const fromCellX = fromX + offsetX;
            const fromCellY = fromY + offsetY;

            const firstCornerX = fromCellX + dx;
            const firstCornerY = fromCellY;
            const secondCornerX = fromCellX;
            const secondCornerY = fromCellY + dy;

            if(
                blocksDiagonalCorner(map,firstCornerX,firstCornerY) ||
                blocksDiagonalCorner(map,secondCornerX,secondCornerY)
            ){
                return true;
            }
        }
    }

    return false;
}


function getOccupantsAt(characters,x,y){

    if(!Array.isArray(characters)){
        return [];
    }

    return characters.filter(character => {

        if(!character.position){
            return false;
        }

        const footprint =
            getCreatureFootprint(character);

        return footprint.squares.some(square =>
            square.x === x &&
            square.y === y
        );
    });
}


function isAlly(character,other){

    return Boolean(
        character &&
        other &&
        character.faction !== undefined &&
        other.faction !== undefined &&
        character.faction === other.faction
    );
}


function hasIncapacitatedCondition(character){

    if(!character || !Array.isArray(character.conditions)){
        return false;
    }

    return character.conditions.some(condition => {

        if(typeof condition === "string"){
            return condition === "Incapacitated";
        }

        return condition &&
            condition.name === "Incapacitated";
    });
}


function canPassThroughCreature(character,other){

    if(!character || !other){
        return false;
    }

    if(other.id === character.id){
        return true;
    }

    if(isAlly(character,other)){
        return true;
    }

    if(hasIncapacitatedCondition(other)){
        return true;
    }

    if(other.size === "Tiny"){
        return true;
    }

    const moverSize = SIZE_ORDER[character.size];
    const otherSize = SIZE_ORDER[other.size];

    if(moverSize === undefined || otherSize === undefined){
        return false;
    }

    return Math.abs(moverSize - otherSize) >= 2;
}


function getCreatureMovementCost(character,other,map){

    if(isAlly(character,other) || other.size === "Tiny"){
        return map.rules.feetPerSquare;
    }

    return map.rules.feetPerSquare * 2;
}


function evaluateSquare(character,x,y,map,characters,isFinal){

    if(!isInsideMap(map,x,y)){
        return {
            allowed:false,
            cost:0,
            occupants:[]
        };
    }

    const occupants =
        getOccupantsAt(characters,x,y).filter(other =>
            other.id !== character.id
        );

    if(occupants.length === 0){

        const terrainCost =
            isDifficultTerrain(map,x,y)
                ? map.rules.feetPerSquare * 2
                : map.rules.feetPerSquare;

        return {
            allowed:true,
            cost:terrainCost,
            occupants:[]
        };
    }

    if(isFinal){

        return {
            allowed:false,
            cost:0,
            occupants:occupants
        };
    }

    let costMultiplier =
        isDifficultTerrain(map,x,y) ? 2 : 1;

    for(const occupant of occupants){

        if(!canPassThroughCreature(character,occupant)){

            return {
                allowed:false,
                cost:0,
                occupants:occupants
            };
        }

        const creatureCost =
            getCreatureMovementCost(
                character,
                occupant,
                map
            );

        if(creatureCost > map.rules.feetPerSquare){
            costMultiplier = Math.max(costMultiplier,2);
        }
    }

    return {
        allowed:true,
        cost:map.rules.feetPerSquare * costMultiplier,
        occupants:occupants
    };
}


function evaluateFootprint(character,x,y,map,characters,isFinal){

    const footprint =
        getCreatureFootprint(character,x,y);

    if(!isFootprintInsideMap(map,character,x,y)){
        return {
            allowed:false,
            cost:0,
            occupants:[]
        };
    }

    let movementCost =
        map.rules.feetPerSquare;

    const occupants = [];

    for(const square of footprint.squares){

        const result =
            evaluateSquare(
                character,
                square.x,
                square.y,
                map,
                characters,
                isFinal
            );

        if(!result.allowed){
            return {
                allowed:false,
                cost:0,
                occupants:result.occupants || occupants
            };
        }

        movementCost =
            Math.max(movementCost,result.cost);

        for(const occupant of result.occupants){
            if(!occupants.some(existing => existing.id === occupant.id)){
                occupants.push(occupant);
            }
        }
    }

    return {
        allowed:true,
        cost:movementCost,
        occupants:occupants
    };
}


function getMovementCost(character,x,y,map,characters=[]){

    const path =
        getMovementPath(character,x,y);

    let cost = 0;
    let previousX = character.position.x;
    let previousY = character.position.y;

    const footprintSide =
        getCreatureFootprint(character).side;

    for(let index = 0; index < path.length; index += 1){

        const step = path[index];
        const isFinal = index === path.length - 1;

        if(
            crossesBlockedCorner(
                map,
                previousX,
                previousY,
                step.x,
                step.y,
                footprintSide
            )
        ){
            return Infinity;
        }

        const square =
            evaluateFootprint(
                character,
                step.x,
                step.y,
                map,
                characters,
                isFinal
            );

        if(!square.allowed){
            return Infinity;
        }

        cost += square.cost;
        previousX = step.x;
        previousY = step.y;
    }

    return cost;
}


function canMoveTo(character,x,y,map,characters=[]){

    const cost =
        getMovementCost(
            character,
            x,
            y,
            map,
            characters
        );

    const remaining =
        character.movement.remaining;

    if(cost === Infinity || cost > remaining){

        console.log(
            "Movement blocked or too far",
            cost,
            "/",
            remaining
        );

        return {
            allowed:false,
            cost:0,
            path:[]
        };
    }

    return {
        allowed:true,
        cost:cost,
        path:getMovementPath(character,x,y)
    };
}


function moveCharacter(character,x,y,map,characters=[]){

    const result =
        canMoveTo(
            character,
            x,
            y,
            map,
            characters
        );

    if(!result.allowed){

        return {
            success:false,
            cost:0,
            transaction:null
        };

    }

    const transaction = {

        character: character.id,

        from:{
            x: character.position.x,
            y: character.position.y
        },

        to:{
            x: x,
            y: y
        },

        cost: result.cost,

        path: result.path
    };

    character.position.x = x;
    character.position.y = y;

    character.movement.remaining -= result.cost;
    character.movement.spent += result.cost;

    return {
        success:true,
        cost:result.cost,
        transaction:transaction
    };
}


function undoMovement(character,transaction){

    if(!transaction){

        return {
            success:false,
            cost:0
        };

    }

    if(transaction.character !== character.id){

        return {
            success:false,
            cost:0
        };

    }

    if(
        character.position.x !== transaction.to.x ||
        character.position.y !== transaction.to.y
    ){

        return {
            success:false,
            cost:0
        };

    }

    character.position.x =
        transaction.from.x;

    character.position.y =
        transaction.from.y;

    character.movement.remaining +=
        transaction.cost;

    character.movement.spent -=
        transaction.cost;

    return {
        success:true,
        cost:transaction.cost
    };
}


function resetMovement(character){

    if(!character || !character.movement){

        return {
            success:false
        };

    }

    character.movement.remaining =
        character.movement.types.walk;

    character.movement.spent = 0;

    return {
        success:true
    };
}
