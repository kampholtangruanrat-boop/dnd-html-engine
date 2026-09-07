function getMapTile(map,x,y){

    if(!map || !Array.isArray(map.tiles)){
        return null;
    }

    return map.tiles.find(tile =>
        tile.x === x && tile.y === y
    ) || null;
}


function isDifficultTerrain(map,x,y){

    const tile =
        getMapTile(map,x,y);

    return Boolean(
        tile && tile.difficult === true
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


function getMovementCost(character,x,y,map){

    const path =
        getMovementPath(character,x,y);

    let cost = 0;

    for(const step of path){

        const squareCost =
            isDifficultTerrain(map,step.x,step.y)
                ? 2
                : 1;

        cost +=
            squareCost * map.rules.feetPerSquare;
    }

    return cost;
}


function canMoveTo(character,x,y,map){

    const cost =
        getMovementCost(
            character,
            x,
            y,
            map
        );

    const remaining =
        character.movement.remaining;

    if(cost > remaining){

        console.log(
            "Too far",
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


function moveCharacter(character,x,y,map){

    const result =
        canMoveTo(
            character,
            x,
            y,
            map
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
