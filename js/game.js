let gameState = {
    party: [],
    encounterEnemies: [],
    map: null,
    activeCharacter: null,
    selectedTargetId: null,
    movementHistory: {},
    turn: {
        active:false,
        phase:"idle",
        round:0,
        turnIndex:-1,
        initiative:[],
        pendingRolls:[]
    }
};

function getAllCombatants(){
    return gameState.party.concat(gameState.encounterEnemies || []);
}

async function loadGame(){
    console.log("Game loading");

    const characterResponse = await fetch("data/characters.json");
    gameState.party = await characterResponse.json();

    const encounterResponse = await fetch("data/encounter.json");
    const encounter = await encounterResponse.json();
    gameState.encounterEnemies = Array.isArray(encounter.enemies)
        ? encounter.enemies
        : [];

    const mapResponse = await fetch("data/map.json");
    gameState.map = await mapResponse.json();

    gameState.activeCharacter = gameState.party[0] || null;
    gameState.selectedTargetId = null;

    renderParty();
    renderTurnOrder();
    renderActiveCharacter();
    renderMap();
    renderCombatActions();
}

function renderParty(){
    const partyArea = document.getElementById("party");
    partyArea.innerHTML = "";

    gameState.party.forEach(character => {
        partyArea.innerHTML += `
        <div>
        <h3>${character.name}</h3>
        Class: ${character.class}<br>
        HP: ${character.hp}/${character.max_hp}<br>
        AC: ${character.ac}<br>
        <button onclick="setActiveCharacter('${character.id}')">Select</button>
        </div>
        <hr>
        `;
    });
}

function setActiveCharacter(id){
    const character = getAllCombatants().find(c => c.id === id);
    if(!character){
        return;
    }

    if(character.faction === "enemy" && gameState.turn.active){
        return;
    }

    if(gameState.turn.active){
        const currentCharacter = getCurrentTurnCharacter(
            gameState.turn,
            gameState.party
        );

        if(!currentCharacter || currentCharacter.id !== id){
            console.log("Cannot select another character during combat");
            return;
        }
    }

    gameState.activeCharacter = character;
    gameState.selectedTargetId = null;
    renderActiveCharacter();
    renderMap();
    renderCombatActions();
}

function renderTurnOrder(){
    const area = document.getElementById("turn-order");
    if(!area){
        return;
    }

    if(!gameState.turn.active){
        area.innerHTML = `
        Combat: Not started
        <br><br>
        <button onclick="startCombat()">Start Combat</button>
        `;
        return;
    }

    if(gameState.turn.phase === "initiative_pending"){
        return;
    }

    const rows = gameState.turn.initiative.map((entry,index) => {
        const character = getAllCombatants().find(c => c.id === entry.characterId);
        const marker = index === gameState.turn.turnIndex ? " <- Current" : "";
        return `<div>${character ? character.name : entry.characterId}: Initiative ${entry.total}${marker}</div>`;
    }).join("");

    area.innerHTML = `
    Round: ${gameState.turn.round}
    <br><br>
    ${rows}
    <br>
    <button onclick="endCurrentTurn()">End Turn</button>
    `;
}

function renderActiveCharacter(){
    const area = document.getElementById("active");
    const c = gameState.activeCharacter;

    if(!c){
        area.innerHTML = "No active character";
        return;
    }

    const resources = c.turnResources || {
        actionUsed:false,
        bonusActionUsed:false,
        reactionUsed:false
    };

    area.innerHTML = `
    <h2>Active Character</h2>
    <h3>${c.name}</h3>
    Class: ${c.class}<br>
    HP: ${c.hp}/${c.max_hp}<br>
    AC: ${c.ac}<br>
    Movement: ${c.movement.remaining}/${c.movement.types.walk}
    <br>
    Action: ${resources.actionUsed ? "Used" : "Available"}
    <br>
    Bonus Action: ${resources.bonusActionUsed ? "Used" : "Available"}
    <br>
    Reaction: ${resources.reactionUsed ? "Used" : "Available"}
    <br><br>
    <button onclick="undoMove()">Undo Movement</button>
    `;
}

function renderMap(){
    const map = document.getElementById("map");
    map.innerHTML = "";
    const combatants = getAllCombatants();

    for(let y=1; y<=gameState.map.height; y++){
        for(let x=1; x<=gameState.map.width; x++){
            let token = "";
            const character = combatants.find(c =>
                c.position && c.position.x === x && c.position.y === y
            );

            if(character){
                const handler = character.faction === "enemy"
                    ? `selectCombatTarget('${character.id}')`
                    : `setActiveCharacter('${character.id}')`;

                token = `
                <button onclick="event.stopPropagation(); ${handler}">
                ${character.name[0]}
                </button>
                `;
            }

            map.innerHTML += `
            <div class="tile" onclick="moveActiveCharacter(${x},${y})">
            ${token}
            </div>
            `;
        }
    }
}

function moveActiveCharacter(x,y){
    if(!gameState.activeCharacter){
        console.log("No active character");
        return;
    }

    if(gameState.turn.active){
        const currentCharacter = getCurrentTurnCharacter(
            gameState.turn,
            gameState.party
        );

        if(!currentCharacter || currentCharacter.id !== gameState.activeCharacter.id){
            console.log("Not this character's turn");
            return;
        }
    }

    const character = gameState.activeCharacter;
    const result = moveCharacter(
        character,
        x,
        y,
        gameState.map,
        getAllCombatants()
    );

    if(!result.success){
        console.log("Movement blocked or too far", result.cost, character.movement.remaining);
        return;
    }

    if(!gameState.movementHistory[character.id]){
        gameState.movementHistory[character.id] = [];
    }

    gameState.movementHistory[character.id].push(result.transaction);
    console.log(
        "Moved",
        character.name,
        "Cost:", result.cost,
        "Remaining:", character.movement.remaining
    );

    renderMap();
    renderActiveCharacter();
    renderCombatActions();
}

function undoMove(){
    if(!gameState.activeCharacter){
        console.log("No active character");
        return;
    }

    const character = gameState.activeCharacter;
    const history = gameState.movementHistory[character.id];

    if(!history || history.length === 0){
        console.log("No movement to undo");
        return;
    }

    const lastMove = history[history.length - 1];
    const result = undoMovement(character,lastMove);

    if(!result.success){
        return;
    }

    history.pop();
    console.log("Undo", character.name);
    renderMap();
    renderActiveCharacter();
    renderCombatActions();
}

function startCombat(){
    if(gameState.turn.active){
        return;
    }

    // Enemy encounter data is visible to targeting, but enemy Initiative
    // remains disabled until the Python RNG boundary is implemented.
    const result = initializeCombat(gameState.party);
    if(!result.success){
        return;
    }

    gameState.turn = result.state;
    gameState.selectedTargetId = null;
    gameState.activeCharacter = getCurrentTurnCharacter(
        gameState.turn,
        gameState.party
    );

    renderParty();
    renderTurnOrder();
    renderActiveCharacter();
    renderMap();
    renderCombatActions();
}

function endCurrentTurn(){
    if(!gameState.turn.active){
        return;
    }

    const result = advanceTurn(gameState.turn,gameState.party);
    if(!result.success){
        return;
    }

    if(result.previousCharacterId){
        delete gameState.movementHistory[result.previousCharacterId];
    }

    gameState.turn = result.state;
    gameState.selectedTargetId = null;
    gameState.activeCharacter = getCurrentTurnCharacter(
        gameState.turn,
        gameState.party
    );

    renderParty();
    renderTurnOrder();
    renderActiveCharacter();
    renderMap();
    renderCombatActions();
}

loadGame();
