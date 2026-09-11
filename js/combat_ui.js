function getCurrentPlayerCharacter(){
    if(!gameState.turn || gameState.turn.phase !== "turn"){
        return null;
    }

    const current = getCurrentTurnCharacter(
        gameState.turn,
        getAllCombatants()
    );

    if(!current || current.faction !== "player"){
        return null;
    }

    return current;
}

function getHostileTargets(character){
    if(!character){
        return [];
    }

    return getAllCombatants().filter(target =>
        target.id !== character.id
        && target.faction !== undefined
        && target.faction !== character.faction
        && Number(target.hp) > 0
    );
}

function selectCombatTarget(targetId){
    const actor = getCurrentPlayerCharacter();
    if(!actor){
        return;
    }

    const target = getHostileTargets(actor).find(candidate => candidate.id === targetId);
    if(!target){
        return;
    }

    gameState.selectedTargetId = target.id;
    renderMap();
    renderCombatActions();
}

function createConfirmedAttackIntent(actor,targetId,attackSpec){
    const created = createIntent({
        intentId:`intent-${gameState.turn.combatId}-${gameState.turn.eventSequence + 1}`,
        actorId:actor.id,
        type:"action",
        payload:{
            actionId:attackSpec.actionId,
            attack:{
                targetId:targetId,
                attackMode:attackSpec.attackMode,
                reachFeet:attackSpec.reachFeet,
                normalRangeFeet:attackSpec.normalRangeFeet,
                longRangeFeet:attackSpec.longRangeFeet,
                attackBonus:attackSpec.attackBonus,
                rollMode:attackSpec.rollMode
            }
        },
        source:"player",
        rawText:"UI attack"
    });

    if(!created.success){
        return created;
    }

    return {
        success:true,
        intent:{...created.intent,status:"confirmed"}
    };
}

function getSelectedTargetId(targets){
    const selected = gameState.selectedTargetId;
    if(selected && targets.some(target => target.id === selected)){
        return selected;
    }

    return targets.length > 0 ? targets[0].id : null;
}

function openAttackUI(){
    const area = document.getElementById("combat-actions");
    const actor = getCurrentPlayerCharacter();

    if(!area || !actor){
        return;
    }

    const attacks = Array.isArray(actor.attacks) ? actor.attacks : [];
    const targets = getHostileTargets(actor);

    if(!attacks.length){
        area.innerHTML = `
            <strong>Actions</strong><br>
            No attack is configured for ${actor.name}.
        `;
        return;
    }

    if(!targets.length){
        area.innerHTML = `
            <strong>Actions — ${actor.name}</strong><br><br>
            No hostile combatants are present in this encounter.<br><br>
            <button onclick="renderCombatActions()">Refresh</button>
        `;
        return;
    }

    const attack = attacks[0];
    const selectedTargetId = getSelectedTargetId(targets);
    gameState.selectedTargetId = selectedTargetId;

    const targetOptions = targets.map(target =>
        `<option value="${target.id}" ${target.id === selectedTargetId ? "selected" : ""}>${target.name} (AC ${target.ac})</option>`
    ).join("");

    area.innerHTML = `
        <strong>Actions — ${actor.name}</strong><br><br>
        <label>
            Attack target:
            <select id="attack-target" onchange="selectCombatTarget(this.value)">${targetOptions}</select>
        </label><br>
        <small>Tip: click an enemy token on the map to select it as the target.</small><br><br>
        <label>
            Roll mode:
            <select id="attack-roll-mode">
                <option value="normal">Normal</option>
                <option value="advantage">Advantage</option>
                <option value="disadvantage">Disadvantage</option>
            </select>
        </label><br><br>
        <button onclick="beginAttackFromUI()">Attack with ${attack.name}</button>
        <button onclick="endCurrentTurn()">End Turn</button>
    `;
}

function renderCombatError(title,message){
    const area = document.getElementById("combat-actions");
    if(!area){
        return;
    }

    area.innerHTML = `
        <strong>${title}</strong><br><br>
        ${message}<br><br>
        <button onclick="renderCombatActions()">Retry</button>
        <button onclick="endCurrentTurn()">End Turn</button>
    `;
}

function beginAttackFromUI(){
    const area = document.getElementById("combat-actions");
    const actor = getCurrentPlayerCharacter();

    if(!area || !actor){
        return;
    }

    const attacks = Array.isArray(actor.attacks) ? actor.attacks : [];
    const attack = attacks[0];
    const targetSelect = document.getElementById("attack-target");
    const modeSelect = document.getElementById("attack-roll-mode");

    if(!attack || !targetSelect || !modeSelect){
        renderCombatError("Attack unavailable","Attack selection is no longer valid. Refresh the action panel.");
        return;
    }

    gameState.selectedTargetId = targetSelect.value;

    const intentResult = createConfirmedAttackIntent(
        actor,
        targetSelect.value,
        {...attack,rollMode:modeSelect.value}
    );

    if(!intentResult.success){
        renderCombatError("Attack rejected",intentResult.reason || "Unknown error");
        return;
    }

    const combatants = getAllCombatants();

    const plan = createActionResolutionPlan(
        gameState.turn,
        combatants,
        intentResult.intent
    );

    if(!plan.success){
        renderCombatError("Attack action rejected",plan.reason);
        return;
    }

    const attackRequest = createAttackRollRequest(
        gameState.turn,
        combatants,
        gameState.map,
        intentResult.intent
    );

    if(!attackRequest.success){
        renderCombatError("Attack rejected",attackRequest.reason);
        return;
    }

    const committed = commitActionResolution(
        gameState.turn,
        combatants,
        intentResult.intent,
        plan.plan
    );

    if(!committed.success){
        renderCombatError("Action commit rejected",committed.reason);
        return;
    }

    renderAttackRollRequest(attackRequest);
    renderActiveCharacter();
}

function renderAttackRollRequest(attackRequest){
    const area = document.getElementById("combat-actions");
    if(!area){
        return;
    }

    const count = attackRequest.request.dice.count;
    const inputExample = count === 1 ? "e.g. 17" : "e.g. 17,4 or 17 4";

    area.innerHTML = `
        <strong>Attack Roll</strong><br><br>
        ${count}d${attackRequest.request.dice.sides} — ${attackRequest.request.mode}<br>
        ${count === 1 ? "Enter the physical d20 result." : "Enter both physical d20 results. The engine will keep the higher/lower result."}<br><br>
        <input id="attack-roll-results" type="text" placeholder="${inputExample}">
        <button onclick="submitAttackFromUI('${attackRequest.request.rollId}',${attackRequest.targetAC},${attackRequest.attackBonus},'${attackRequest.targetId}')">Submit Attack Roll</button>
    `;
}

function parseRollResultsInput(value){
    if(typeof value !== "string"){
        return [];
    }

    return value
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(value => Number(value))
        .filter(value => Number.isInteger(value));
}

function submitAttackFromUI(rollId,targetAC,attackBonus,targetId){
    const area = document.getElementById("combat-actions");
    const request = getPendingRoll(gameState.turn,rollId);
    const input = document.getElementById("attack-roll-results");

    if(!area || !request || !input){
        renderCombatError("Attack roll unavailable","The attack RollRequest is no longer pending. Return to the action panel and start a new attack.");
        return;
    }

    const results = parseRollResultsInput(input.value);

    if(results.length !== request.dice.count){
        const expected = request.dice.count === 1
            ? "exactly 1 d20 result"
            : "exactly 2 d20 results (for example 15,7 or 15 7)";
        area.innerHTML += `<br><strong>Input rejected:</strong> enter ${expected}.`;
        return;
    }

    const submitted = submitAttackRoll(
        gameState.turn,
        request,
        {
            rollId:rollId,
            source:request.source,
            results:results
        },
        targetAC,
        attackBonus
    );

    if(!submitted.success){
        renderCombatError("Attack roll rejected",submitted.reason);
        return;
    }

    if(submitted.result.outcome !== "hit"){
        area.innerHTML = `
            <strong>Attack Result</strong><br><br>
            MISS — d20 ${submitted.result.selected} + ${attackBonus} = ${submitted.result.attackTotal}<br><br>
            <button onclick="renderCombatActions()">Continue</button>
        `;
        renderActiveCharacter();
        return;
    }

    const actor = getCurrentPlayerCharacter();
    const target = getAllCombatants().find(character => character.id === targetId);
    const attack = actor && Array.isArray(actor.attacks) ? actor.attacks[0] : null;

    if(!actor || !target || !attack){
        area.innerHTML = `
            <strong>Attack Result</strong><br><br>
            HIT, but no damage specification is configured.<br><br>
            <button onclick="renderCombatActions()">Continue</button>
        `;
        return;
    }

    const damageRequest = createDamageRollForAttack(
        gameState.turn,
        request,
        submitted.result,
        {
            targetId:target.id,
            actorId:actor.id,
            dice:attack.damageDice,
            damageBonus:attack.damageBonus,
            damageType:attack.damageType
        }
    );

    if(!damageRequest.success){
        renderCombatError("Damage request rejected",damageRequest.reason);
        return;
    }

    area.innerHTML = `
        <strong>HIT${submitted.result.critical ? " — CRITICAL" : ""}</strong><br><br>
        Attack total: ${submitted.result.attackTotal} vs AC ${targetAC}<br>
        Damage: ${damageRequest.request.dice.count}d${damageRequest.request.dice.sides} ${attack.damageBonus >= 0 ? "+" : ""}${attack.damageBonus} ${attack.damageType}<br><br>
        <input id="damage-roll-results" type="text" placeholder="${damageRequest.request.dice.count === 1 ? "e.g. 6" : "e.g. 6,3 or 6 3"}">
        <button onclick="submitDamageFromUI('${damageRequest.request.rollId}','${target.id}',${attack.damageBonus},'${attack.damageType}')">Submit Damage Roll</button>
    `;
}

function submitDamageFromUI(rollId,targetId,damageBonus,damageType){
    const area = document.getElementById("combat-actions");
    const request = getPendingRoll(gameState.turn,rollId);
    const target = getAllCombatants().find(character => character.id === targetId);
    const input = document.getElementById("damage-roll-results");

    if(!area || !request || !target || !input){
        renderCombatError("Damage roll unavailable","The damage RollRequest is no longer pending. Return to the action panel and start a new attack.");
        return;
    }

    const results = parseRollResultsInput(input.value);

    if(results.length !== request.dice.count){
        const expected = request.dice.count === 1
            ? "exactly 1 damage die result"
            : `exactly ${request.dice.count} damage die results`;
        area.innerHTML += `<br><strong>Input rejected:</strong> enter ${expected}.`;
        return;
    }

    const submitted = submitDamageRollForAttack(
        gameState.turn,
        request,
        {
            rollId:rollId,
            source:request.source,
            results:results
        },
        target,
        damageBonus,
        damageType
    );

    if(!submitted.success){
        renderCombatError("Damage roll rejected",submitted.reason);
        return;
    }

    renderParty();
    renderActiveCharacter();
    renderMap();

    area.innerHTML = `
        <strong>Damage Applied</strong><br><br>
        ${submitted.damage.rawDamage} ${damageType} raw damage<br>
        ${submitted.damage.mitigation}: ${submitted.damage.finalDamage} damage<br>
        ${target.name}: ${submitted.commit.previousHP} → ${submitted.commit.currentHP} HP<br><br>
        <button onclick="renderCombatActions()">Continue</button>
        <button onclick="endCurrentTurn()">End Turn</button>
    `;
}

function renderCombatActions(){
    const area = document.getElementById("combat-actions");
    if(!area){
        return;
    }

    const actor = getCurrentPlayerCharacter();

    if(!actor){
        area.innerHTML = "No player action is available on the current turn.";
        return;
    }

    if(actor.turnResources && actor.turnResources.actionUsed){
        area.innerHTML = `
            <strong>Actions — ${actor.name}</strong><br><br>
            Action used.<br><br>
            <button onclick="endCurrentTurn()">End Turn</button>
        `;
        return;
    }

    openAttackUI();
}
