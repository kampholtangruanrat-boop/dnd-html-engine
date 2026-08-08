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

        return false;

    }


    return true;
}


function getMovementCost(character,x,y,map){

    const distance =
        Math.max(
            Math.abs(character.position.x - x),
            Math.abs(character.position.y - y)
        );


    return distance * map.rules.feetPerSquare;

}
