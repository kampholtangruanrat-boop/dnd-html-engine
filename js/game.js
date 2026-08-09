let gameState = {

    party: [],

    map: null,

    activeCharacter: null,
    
    movementHistory:[]

};



async function loadGame() {

    console.log("Game loading");


    const characterResponse =
        await fetch("data/characters.json");


    gameState.party =
        await characterResponse.json();


    console.log("Characters loaded", gameState.party);



    const mapResponse =
        await fetch("data/map.json");


    gameState.map =
        await mapResponse.json();


    console.log("Map loaded", gameState.map);



    gameState.activeCharacter =
        gameState.party[0];


    renderParty();

    renderActiveCharacter();

    renderMap();

}




function renderParty() {


    const partyArea =
        document.getElementById("party");


    partyArea.innerHTML = "";



    gameState.party.forEach(character => {


        partyArea.innerHTML += `

        <div>

        <h3>${character.name}</h3>

        Class: ${character.class}<br>

        HP:
        ${character.hp}/${character.max_hp}<br>

        AC:
        ${character.ac}

        <br>

        <button onclick="setActiveCharacter('${character.id}')">

        Select

        </button>


        </div>

        <hr>

        `;


    });


}



function renderActiveCharacter() {


    const area =
        document.getElementById("active");


    const c =
        gameState.activeCharacter;



    area.innerHTML = `

    <h2>
    Active Character
    </h2>

    <h3>${c.name}</h3>

    Class:
    ${c.class}<br>

    HP:
    ${c.hp}/${c.max_hp}<br>

    AC:
    ${c.ac}

    `;

}





function renderMap() {


    const map =
        document.getElementById("map");


    map.innerHTML = "";



    for(let y=1; y<=gameState.map.height; y++){


        for(let x=1; x<=gameState.map.width; x++){


            let token = "";



            const character =
                gameState.party.find(
                    c =>
                    c.position.x === x &&
                    c.position.y === y
                );



            if(character){

               token = `

              <button onclick="event.stopPropagation(); setActiveCharacter('${character.id}')">

               ${character.name[0]}

               </button>

                `;

 }



            map.innerHTML += `

            <div 
            class="tile"
            onclick="moveActiveCharacter(${x},${y})"
            >

            ${token}

            </div>

            `;


        }

    }

}

function setActiveCharacter(id){

    const character = gameState.party.find(
        c => c.id === id
    );


    if(character){

        gameState.activeCharacter = character;

        renderActiveCharacter();
        renderMap();
        
    }

}

function moveActiveCharacter(x,y){

    if(!gameState.activeCharacter){

        console.log("No active character");

        return;

    }


    const character =
        gameState.activeCharacter;


    const result =
        canMoveTo(
            character,
            x,
            y,
            gameState.map
        );


    if(result.allowed){


        gameState.movementHistory.push({

            character: character.id,

            from:{
                x:character.position.x,
                y:character.position.y
            },

            to:{
                x:x,
                y:y
            },

            cost:result.cost

        });


        character.position.x = x;

        character.position.y = y;


        character.movement.remaining -= result.cost;

        character.movement.spent += result.cost;


        console.log(
            "Moved",
            character.name,
            "Cost:",
            result.cost,
            "Remaining:",
            character.movement.remaining
        );


        renderMap();

        renderActiveCharacter();

    }

}

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


function undoMove(){

    const lastMove =
        gameState.movementHistory.pop();


    if(!lastMove){

        console.log("No movement to undo");

        return;

    }


    const character =
        gameState.party.find(
            c => c.id === lastMove.character
        );


    if(!character){

        console.log("Character not found");

        return;

    }


    character.position.x =
        lastMove.from.x;

    character.position.y =
        lastMove.from.y;


    character.movement.remaining +=
        lastMove.cost;


    character.movement.spent -=
        lastMove.cost;


    console.log(
        "Undo movement",
        character.name
    );


    renderMap();

    renderActiveCharacter();

}



loadGame();
