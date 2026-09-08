function getAttackDistanceFeet(attacker,target,map){

    if(!attacker || !target || !attacker.position || !target.position){
        return null;
    }

    const feetPerSquare =
        map && map.rules && Number.isInteger(map.rules.feetPerSquare)
            ? map.rules.feetPerSquare
            : 5;

    const dx = Math.abs(target.position.x - attacker.position.x);
    const dy = Math.abs(target.position.y - attacker.position.y);

    return Math.max(dx,dy) * feetPerSquare;
}


function getCharacterById(characters,characterId){

    if(!Array.isArray(characters) || typeof characterId !== "string"){
        return null;
    }

    return characters.find(character => character.id === characterId) || null;
}


function isHostileAttack(attacker,target){

    return Boolean(
        attacker &&
        target &&
        attacker.faction !== undefined &&
        target.faction !== undefined &&
        attacker.faction !== target.faction
    );
}


function validateAttackIntent(state,characters,map,intent){

    if(!state || !state.active || state.phase !== "turn"){
        return {valid:false,reason:"Attacks can only be resolved during an active turn"};
    }

    if(!intent || intent.status !== "confirmed"){
        return {valid:false,reason:"Attack intent must be confirmed before resolution"};
    }

    if(intent.type !== "action" && intent.type !== "bonus_action" && intent.type !== "reaction"){
        return {valid:false,reason:"Attack must use an Action, Bonus Action, or Reaction intent"};
    }

    const attacker = getCharacterById(characters,intent.actorId);
    if(!attacker){
        return {valid:false,reason:"Attack actor is not a combatant"};
    }

    const currentEntry = state.initiative[state.turnIndex];
    if(!currentEntry || currentEntry.characterId !== attacker.id){
        return {valid:false,reason:"Only the current turn actor can make this attack"};
    }

    if(!intent.payload || typeof intent.payload !== "object" || Array.isArray(intent.payload)){
        return {valid:false,reason:"Attack intent payload must be an object"};
    }

    const attack = intent.payload.attack;
    if(!attack || typeof attack !== "object" || Array.isArray(attack)){
        return {valid:false,reason:"Attack payload is required"};
    }

    const target = getCharacterById(characters,attack.targetId);
    if(!target || target.id === attacker.id){
        return {valid:false,reason:"Attack target is invalid"};
    }

    if(!isHostileAttack(attacker,target)){
        return {valid:false,reason:"Attack target must be hostile"};
    }

    if(!Number.isInteger(target.ac) || target.ac < 0){
        return {valid:false,reason:"Attack target must have a valid Armor Class"};
    }

    const attackMode = attack.attackMode || "melee";
    if(attackMode !== "melee" && attackMode !== "ranged"){
        return {valid:false,reason:"Attack mode must be melee or ranged"};
    }

    const distanceFeet = getAttackDistanceFeet(attacker,target,map);
    if(distanceFeet === null){
        return {valid:false,reason:"Attacker and target positions are required"};
    }

    if(attackMode === "melee"){
        const reach = Number.isInteger(attack.reachFeet) ? attack.reachFeet : 5;
        if(distanceFeet > reach){
            return {valid:false,reason:"Target is outside melee reach"};
        }
    }

    if(attackMode === "ranged"){
        const normalRangeFeet = attack.normalRangeFeet;
        const longRangeFeet = attack.longRangeFeet;

        if(!Number.isInteger(normalRangeFeet) || normalRangeFeet <= 0
            || !Number.isInteger(longRangeFeet) || longRangeFeet < normalRangeFeet){
            return {valid:false,reason:"Ranged attack requires valid normal and long ranges"};
        }

        if(distanceFeet > longRangeFeet){
            return {valid:false,reason:"Target is outside ranged long range"};
        }
    }

    if(!Number.isInteger(attack.attackBonus)){
        return {valid:false,reason:"Attack requires an integer attackBonus"};
    }

    const mode =
        attack.rollMode === undefined ? "normal" : attack.rollMode;

    if(mode !== "normal" && mode !== "advantage" && mode !== "disadvantage"){
        return {valid:false,reason:"Attack rollMode is invalid"};
    }

    return {
        valid:true,
        reason:null,
        attacker:attacker,
        target:target,
        attackMode:attackMode,
        distanceFeet:distanceFeet,
        attackBonus:attack.attackBonus,
        rollMode:mode
    };
}


function createAttackRollRequest(state,characters,map,intent){

    const validation = validateAttackIntent(state,characters,map,intent);

    if(!validation.valid){
        return {success:false,request:null,reason:validation.reason};
    }

    const rollId =
        `attack-${state.combatId}-${state.eventSequence + 1}`;

    const created = createRollRequest({
        rollId:rollId,
        actorId:intent.actorId,
        control:validation.attacker.faction === "player" ? "player" : "enemy",
        type:"attack",
        dice:{count:validation.rollMode === "normal" ? 1 : 2,sides:20},
        mode:validation.rollMode,
        source:validation.attacker.faction === "player" ? "player" : "python_rng"
    });

    if(!created.success){
        return {success:false,request:null,reason:created.reason};
    }

    state.pendingRolls.push(created.request);

    return {
        success:true,
        request:created.request,
        targetId:validation.target.id,
        targetAC:validation.target.ac,
        attackBonus:validation.attackBonus,
        attackMode:validation.attackMode,
        distanceFeet:validation.distanceFeet
    };
}


function resolveAttackRoll(request,rollResult,targetAC,attackBonus){

    if(!request || request.type !== "attack" || !rollResult){
        return {success:false,reason:"Invalid attack RollRequest or RollResult"};
    }

    const validation = validateRollResult(request,rollResult);
    if(!validation.valid){
        return {success:false,reason:validation.reason};
    }

    if(!Number.isInteger(targetAC) || targetAC < 0 || !Number.isInteger(attackBonus)){
        return {success:false,reason:"Attack resolution requires target AC and attack bonus"};
    }

    let selected = rollResult.results[0];
    if(request.mode === "advantage") selected = Math.max(...rollResult.results);
    if(request.mode === "disadvantage") selected = Math.min(...rollResult.results);

    const natural20 = selected === 20;
    const natural1 = selected === 1;
    let outcome = "miss";
    let total = selected + attackBonus;

    if(natural20){
        outcome = "hit";
    }else if(natural1){
        outcome = "miss";
    }else if(total >= targetAC){
        outcome = "hit";
    }

    return {
        success:true,
        selected:selected,
        results:[...rollResult.results],
        attackTotal:total,
        targetAC:targetAC,
        outcome:outcome,
        critical:natural20
    };
}


function submitAttackRoll(state,request,rollResult,targetAC,attackBonus){

    if(!state || !request){
        return {success:false,state:state,reason:"Attack state and request are required"};
    }

    const submission = submitRollResult(state,rollResult);
    if(!submission.success){
        return {success:false,state:state,reason:submission.reason};
    }

    const resolved = resolveAttackRoll(request,rollResult,targetAC,attackBonus);
    if(!resolved.success){
        return {success:false,state:state,reason:resolved.reason};
    }

    return {
        success:true,
        state:state,
        result:resolved,
        allRollsResolved:submission.allRollsResolved
    };
}
