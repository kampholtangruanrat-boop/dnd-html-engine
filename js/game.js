let gameState = {
    party: [],
    activeCharacter: null
};


async function loadCharacters() {

    const response = await fetch("data/characters.json");

    gameState.party = await response.json();

    gameState.activeCharacter = gameState.party[0];

    renderParty();
}


function renderParty() {

    const partyArea = document.getElementById("party");

partyArea.innerHTML += `

<div>

<h3>${character.name}</h3>

<p>
Class: ${character.class}<br>
HP: ${character.hp}/${character.max_hp}<br>
AC: ${character.ac}
</p>

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
            character => character.id === id
        );

    renderActiveCharacter();

}


function renderActiveCharacter() {

    const activeArea =
        document.getElementById("active");

    const character =
        gameState.activeCharacter;


    activeArea.innerHTML = `

        <h2>Active Character</h2>

        <h3>${character.name}</h3>

        Class: ${character.class}<br>
        HP: ${character.hp}/${character.max_hp}<br>
        AC: ${character.ac}

    `;
}

loadCharacters();
