function canMoveTo(character,x,y){


    const speed =
        character.base_speed || 30;


    const distance =
        Math.abs(character.position.x - x)
        +
        Math.abs(character.position.y - y);



    const cost =
        distance * 5;



    if(cost > speed){

        console.log(
            "Too far",
            cost,
            "/",
            speed
        );

        return false;

    }


    return true;

}
