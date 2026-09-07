function canMoveTo(character,x,y,map){

    const remaining =
        character.movement.remaining;

    const distance =
        Math.max(
            Math.abs(character.position.x - x),
            Math.abs(character.position.y - y)
        );

    const cost =
        distance * map.rules.feetPerSquare;

    if(cost > remaining){

        console.log(
            "Too far",
            cost,
            "/",
            remaining
        );

        return {
            allowed:false,
            cost:0
        };
    }

    return {
        allowed:true,
        cost:cost
    };
}


function getMovementCost(character,x,y,map){

    const distance =
        Math.max(
            Math.abs(character.position.x - x),
            Math.abs(character.position.y - y)
        );

    return distance * map.rules.feetPerSquare;

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

        cost: result.cost

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
