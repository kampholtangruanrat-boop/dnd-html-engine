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

    partyArea.innerHTML = "";

    gameState.party.forEach(character => {

        partyArea.innerHTML += `
            <div>
                <h3>${character.name}</h3>
                <p>
                Class: ${character.class}<br>
                HP: ${character.hp}/${character.max_hp}<br>
                AC: ${character.ac}
                </p>
            </div>
        `;

    });

}


loadCharacters();
