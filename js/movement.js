const SIZE_ORDER = {
    Tiny: 0,
    Small: 1,
    Medium: 2,
    Large: 3,
    Huge: 4,
    Gargantuan: 5
};

function getMapTile(map,x,y){
    if(!map || !Array.isArray(map.tiles)) return null;
    return map.tiles.find(tile => tile.x === x && tile.y === y) || null;
}

function isInsideMap(map,x,y){
    return Boolean(
        map && Number.isInteger(x) && Number.isInteger(y) &&
        x >= 1 && y >= 1 && x <= map.width && y <= map.height
    );
}

function isDifficultTerrain(map,x,y){
    const tile = getMapTile(map,x,y);
    return Boolean(tile && tile.difficult === true);
}

function blocksDiagonalCorner(map,x,y){
    if(!isInsideMap(map,x,y)) return true;
    const tile = getMapTile(map,x,y);
    return Boolean(tile && (tile.blocksMovement === true || tile.fillsSpace === true));
}

function getCreatureFootprint(character,x = character.position.x,y = character.position.y){
    let side = 1;
    if(character.size === "Large") side = 2;
    else if(character.size === "Huge") side = 3;
    else if(character.size === "Gargantuan") side = 4;

    const squares = [];
    for(let offsetY = 0; offsetY < side; offsetY += 1){
        for(let offsetX = 0; offsetX < side; offsetX += 1){
            squares.push({x:x + offsetX,y:y + offsetY});
        }
    }

    return {
        side,
        squares,
        sizeIndex:SIZE_ORDER[character.size]
    };
}

function isFootprintInsideMap(map,character,x,y){
    return getCreatureFootprint(character,x,y).squares.every(square =>
        isInsideMap(map,square.x,square.y)
    );
}

function getOccupantsAt(characters,x,y){
    if(!Array.isArray(characters)) return [];

    return characters.filter(character => {
        if(!character.position) return false;
        return getCreatureFootprint(character).squares.some(square =>
            square.x === x && square.y === y
        );
    });
}

function isAlly(character,other){
    return Boolean(
        character && other &&
        character.faction !== undefined &&
        other.faction !== undefined &&
        character.faction === other.faction
    );
}

function hasIncapacitatedCondition(character){
    if(!character || !Array.isArray(character.conditions)) return false;

    return character.conditions.some(condition => {
        if(typeof condition === "string") return condition === "Incapacitated";
        return condition && condition.name === "Incapacitated";
    });
}

function canPassThroughCreature(character,other){
    if(!character || !other) return false;
    if(other.id === character.id) return true;
    if(isAlly(character,other)) return true;
    if(hasIncapacitatedCondition(other)) return true;
    if(other.size === "Tiny") return true;

    const moverSize = SIZE_ORDER[character.size];
    const otherSize = SIZE_ORDER[other.size];
    if(moverSize === undefined || otherSize === undefined) return false;

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
        return {allowed:false,cost:0,occupants:[]};
    }

    const occupants = getOccupantsAt(characters,x,y).filter(other => other.id !== character.id);

    if(occupants.length === 0){
        return {
            allowed:true,
            cost:isDifficultTerrain(map,x,y)
                ? map.rules.feetPerSquare * 2
                : map.rules.feetPerSquare,
            occupants:[]
        };
    }

    if(isFinal){
        return {allowed:false,cost:0,occupants};
    }

    let costMultiplier = isDifficultTerrain(map,x,y) ? 2 : 1;

    for(const occupant of occupants){
        if(!canPassThroughCreature(character,occupant)){
            return {allowed:false,cost:0,occupants};
        }

        if(getCreatureMovementCost(character,occupant,map) > map.rules.feetPerSquare){
            costMultiplier = 2;
        }
    }

    return {
        allowed:true,
        cost:map.rules.feetPerSquare * costMultiplier,
        occupants
    };
}

function evaluateFootprint(character,x,y,map,characters,isFinal){
    if(!isFootprintInsideMap(map,character,x,y)){
        return {allowed:false,cost:0,occupants:[]};
    }

    let movementCost = map.rules.feetPerSquare;
    const occupants = [];

    for(const square of getCreatureFootprint(character,x,y).squares){
        const result = evaluateSquare(
            character,square.x,square.y,map,characters,isFinal
        );

        if(!result.allowed){
            return {
                allowed:false,
                cost:0,
                occupants:result.occupants || occupants
            };
        }

        movementCost = Math.max(movementCost,result.cost);

        for(const occupant of result.occupants){
            if(!occupants.some(existing => existing.id === occupant.id)){
                occupants.push(occupant);
            }
        }
    }

    return {allowed:true,cost:movementCost,occupants};
}

function crossesBlockedCorner(map,fromX,fromY,toX,toY,footprintSide = 1){
    const dx = toX - fromX;
    const dy = toY - fromY;
    if(Math.abs(dx) !== 1 || Math.abs(dy) !== 1) return false;

    for(let offsetY = 0; offsetY < footprintSide; offsetY += 1){
        for(let offsetX = 0; offsetX < footprintSide; offsetX += 1){
            const fromCellX = fromX + offsetX;
            const fromCellY = fromY + offsetY;

            if(
                blocksDiagonalCorner(map,fromCellX + dx,fromCellY) ||
                blocksDiagonalCorner(map,fromCellX,fromCellY + dy)
            ){
                return true;
            }
        }
    }

    return false;
}

function getMovementPath(character,x,y,map,characters=[]){
    if(!isFootprintInsideMap(map,character,x,y)) return [];

    const start = {x:character.position.x,y:character.position.y};
    if(start.x === x && start.y === y) return [];

    const key = (px,py) => `${px},${py}`;
    const queue = [start];
    const distances = new Map([[key(start.x,start.y),0]]);
    const previous = new Map();
    const footprintSide = getCreatureFootprint(character).side;

    while(queue.length > 0){
        let bestIndex = 0;
        for(let index = 1; index < queue.length; index += 1){
            const a = queue[index];
            const b = queue[bestIndex];
            if(distances.get(key(a.x,a.y)) < distances.get(key(b.x,b.y))){
                bestIndex = index;
            }
        }

        const current = queue.splice(bestIndex,1)[0];
        const currentKey = key(current.x,current.y);
        const currentDistance = distances.get(currentKey);

        if(current.x === x && current.y === y){
            const path = [];
            let cursorKey = currentKey;

            while(cursorKey !== key(start.x,start.y)){
                const step = previous.get(cursorKey);
                path.unshift({x:step.x,y:step.y});
                cursorKey = key(step.from.x,step.from.y);
            }

            return path;
        }

        for(let dy = -1; dy <= 1; dy += 1){
            for(let dx = -1; dx <= 1; dx += 1){
                if(dx === 0 && dy === 0) continue;

                const next = {x:current.x + dx,y:current.y + dy};
                if(!isFootprintInsideMap(map,character,next.x,next.y)) continue;

                if(crossesBlockedCorner(
                    map,current.x,current.y,next.x,next.y,footprintSide
                )) continue;

                const isFinal = next.x === x && next.y === y;
                const square = evaluateFootprint(
                    character,next.x,next.y,map,characters,isFinal
                );
                if(!square.allowed) continue;

                const nextKey = key(next.x,next.y);
                const nextDistance = currentDistance + square.cost;

                if(!distances.has(nextKey) || nextDistance < distances.get(nextKey)){
                    distances.set(nextKey,nextDistance);
                    previous.set(nextKey,{
                        x:next.x,
                        y:next.y,
                        from:current,
                        cost:square.cost
                    });

                    if(!queue.some(node => node.x === next.x && node.y === next.y)){
                        queue.push(next);
                    }
                }
            }
        }
    }

    return [];
}

function getMovementCost(character,x,y,map,characters=[]){
    const path = getMovementPath(character,x,y,map,characters);

    if(character.position.x !== x || character.position.y !== y){
        if(path.length === 0) return Infinity;
    }

    let cost = 0;
    let previousX = character.position.x;
    let previousY = character.position.y;

    for(const step of path){
        const isFinal = step.x === x && step.y === y;
        const square = evaluateFootprint(
            character,step.x,step.y,map,characters,isFinal
        );

        if(!square.allowed || crossesBlockedCorner(
            map,previousX,previousY,step.x,step.y,getCreatureFootprint(character).side
        )){
            return Infinity;
        }

        cost += square.cost;
        previousX = step.x;
        previousY = step.y;
    }

    return cost;
}

function canMoveTo(character,x,y,map,characters=[]){
    const path = getMovementPath(character,x,y,map,characters);
    const cost = getMovementCost(character,x,y,map,characters);
    const remaining = character.movement.remaining;

    if(cost === Infinity || cost > remaining){
        console.log("Movement blocked or too far",cost,"/",remaining);
        return {allowed:false,cost:0,path:[]};
    }

    return {allowed:true,cost,path};
}

function moveCharacter(character,x,y,map,characters=[]){
    const result = canMoveTo(character,x,y,map,characters);

    if(!result.allowed){
        return {success:false,cost:0,transaction:null};
    }

    const transaction = {
        character:character.id,
        from:{x:character.position.x,y:character.position.y},
        to:{x:x,y:y},
        cost:result.cost,
        path:result.path
    };

    character.position.x = x;
    character.position.y = y;
    character.movement.remaining -= result.cost;
    character.movement.spent += result.cost;

    return {success:true,cost:result.cost,transaction};
}

function undoMovement(character,transaction){
    if(!transaction || transaction.character !== character.id){
        return {success:false,cost:0};
    }

    if(
        character.position.x !== transaction.to.x ||
        character.position.y !== transaction.to.y
    ){
        return {success:false,cost:0};
    }

    character.position.x = transaction.from.x;
    character.position.y = transaction.from.y;
    character.movement.remaining += transaction.cost;
    character.movement.spent -= transaction.cost;

    return {success:true,cost:transaction.cost};
}

function resetMovement(character){
    if(!character || !character.movement) return {success:false};

    character.movement.remaining = character.movement.types.walk;
    character.movement.spent = 0;

    return {success:true};
}
