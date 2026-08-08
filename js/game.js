let gameState = {

    party: [],

    map: null,

    activeCharacter: null

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





function setActiveCharacter(id) {


    gameState.activeCharacter =
        gameState.party.find(
            c => c.id === id
        );


    renderActiveCharacter();

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

               <button onclick="setActiveCharacter('${character.id}')">

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

    }

}

function moveActiveCharacter(x,y){

if(!gameState.activeCharacter){

console.log("No active character");

return;

}


console.log(
"Before move",
gameState.activeCharacter
);

    const occupied =
    gameState.party.find(
        c =>
        c !== gameState.activeCharacter &&
        c.position.x === x &&
        c.position.y === y
    );


    if(occupied){

        console.log(
            "Tile occupied by",
            occupied.name
        );

    return;

    }

gameState.activeCharacter.position.x=x;
gameState.activeCharacter.position.y=y;


console.log(
"After move",
gameState.activeCharacter
);


renderMap();

renderActiveCharacter();

}

loadGame();
