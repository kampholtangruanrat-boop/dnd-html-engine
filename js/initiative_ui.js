function getInitiativeRollCharacter(request){
    return gameState.party.find(character => character.id === request.actorId) || null;
}

function submitInitiativeFromUI(rollId){
    const request = getPendingRoll(gameState.turn,rollId);
    if(!request){
        return;
    }

    const input = document.getElementById(`initiative-roll-${rollId}`);
    const value = Number(input && input.value);

    if(!Number.isInteger(value)){
        if(input) input.focus();
        return;
    }

    const result = submitInitiativeRoll(
        gameState.turn,
        rollId,
        {
            rollId:rollId,
            source:request.source,
            results:[value]
        },
        gameState.party
    );

    if(!result.success){
        console.log("Initiative roll rejected:",result.reason);
        return;
    }

    renderTurnOrder();
}

function finalizeInitiativeFromUI(){
    const tieGroups = getInitiativeTieGroups(gameState.turn);
    const tieBreakers = {};

    tieGroups.forEach(group => {
        const input = document.getElementById(`initiative-tie-${group.total}`);
        if(!input){
            return;
        }

        const names = input.value
            .split(",")
            .map(value => value.trim())
            .filter(Boolean);

        tieBreakers[String(group.total)] = names;
    });

    const result = finalizeInitiative(
        gameState.turn,
        gameState.party,
        tieBreakers
    );

    if(!result.success){
        console.log("Initiative finalization blocked:",result.reason);
        renderTurnOrder();
        return;
    }

    gameState.activeCharacter = result.character ||
        getCurrentTurnCharacter(gameState.turn,gameState.party);

    renderParty();
    renderTurnOrder();
    renderActiveCharacter();
    renderMap();
}

function renderInitiativePending(){
    const requests = gameState.turn.pendingRolls || [];
    const unresolved = requests.filter(request => request.status === "pending");

    let html = `
        <strong>Combat: Initiative</strong><br><br>
        Each player rolls the requested d20 and enters the face value.<br><br>
    `;

    if(unresolved.length === 0){
        const tieGroups = getInitiativeTieGroups(gameState.turn);

        if(tieGroups.length === 0){
            html += `
                <strong>All initiative rolls received.</strong><br>
                Finalizing initiative...
            `;
            finalizeInitiativeFromUI();
            return;
        }

        html += `<strong>Initiative ties require an explicit order.</strong><br><br>`;

        tieGroups.forEach(group => {
            const labels = group.combatants
                .map(combatant => {
                    const character = getInitiativeRollCharacter({actorId:combatant.characterId});
                    return character ? character.name : combatant.characterId;
                })
                .join(", ");

            html += `
                <div>
                    ${group.total}: ${labels}<br>
                    Order by character ID, comma-separated:
                    <input id="initiative-tie-${group.total}" type="text" placeholder="kenji,mira">
                </div><br>
            `;
        });

        html += `<button onclick="finalizeInitiativeFromUI()">Finalize Initiative</button>`;
        document.getElementById("turn-order").innerHTML = html;
        return;
    }

    unresolved.forEach(request => {
        const character = getInitiativeRollCharacter(request);
        const label = character ? character.name : request.actorId;

        if(request.source === "player"){
            html += `
                <div>
                    <strong>${label}</strong>: roll 1d20<br>
                    <input id="initiative-roll-${request.rollId}" type="number" min="1" max="20" step="1">
                    <button onclick="submitInitiativeFromUI('${request.rollId}')">Submit Roll</button>
                </div><br>
            `;
        }else{
            html += `
                <div>
                    <strong>${label}</strong>: waiting for engine RNG result
                </div><br>
            `;
        }
    });

    document.getElementById("turn-order").innerHTML = html;
}

const previousRenderTurnOrder = renderTurnOrder;

renderTurnOrder = function(){
    if(gameState.turn.active && gameState.turn.phase === "initiative_pending"){
        renderInitiativePending();
        return;
    }

    previousRenderTurnOrder();
};
