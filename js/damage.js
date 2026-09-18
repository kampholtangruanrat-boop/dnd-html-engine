function normalizeDamageType(type){
    if(typeof type !== "string"){
        return null;
    }

    return type.trim().toLowerCase();
}


function getDamageMitigation(target,damageType){
    const normalized = normalizeDamageType(damageType);
    const resistances = Array.isArray(target && target.resistances)
        ? target.resistances.map(normalizeDamageType)
        : [];
    const vulnerabilities = Array.isArray(target && target.vulnerabilities)
        ? target.vulnerabilities.map(normalizeDamageType)
        : [];
    const immunities = Array.isArray(target && target.immunities)
        ? target.immunities.map(normalizeDamageType)
        : [];

    if(normalized && immunities.includes(normalized)){
        return "immunity";
    }

    if(normalized && resistances.includes(normalized)){
        return "resistance";
    }

    if(normalized && vulnerabilities.includes(normalized)){
        return "vulnerability";
    }

    return "normal";
}


function applyDamageMitigation(rawDamage,target,damageType){
    if(!Number.isInteger(rawDamage) || rawDamage < 0){
        return {success:false,reason:"Damage must be a non-negative integer"};
    }

    const mitigation = getDamageMitigation(target,damageType);
    let finalDamage = rawDamage;

    if(mitigation === "immunity"){
        finalDamage = 0;
    }else if(mitigation === "resistance"){
        finalDamage = Math.floor(rawDamage / 2);
    }else if(mitigation === "vulnerability"){
        finalDamage = rawDamage * 2;
    }

    return {
        success:true,
        rawDamage:rawDamage,
        finalDamage:finalDamage,
        mitigation:mitigation
    };
}


function createDamageRollRequest({rollId,actorId,control,dice,source,critical = false}){
    const count = dice && Number.isInteger(dice.count) ? dice.count : 0;
    const sides = dice && Number.isInteger(dice.sides) ? dice.sides : 0;

    if(critical){
        return createRollRequest({
            rollId:rollId,
            actorId:actorId,
            control:control,
            type:"damage",
            dice:{count:count * 2,sides:sides},
            mode:"normal",
            source:source
        });
    }

    return createRollRequest({
        rollId:rollId,
        actorId:actorId,
        control:control,
        type:"damage",
        dice:{count:count,sides:sides},
        mode:"normal",
        source:source
    });
}


function resolveDamageRoll(request,rollResult,damageBonus,target,damageType){
    if(!request || request.type !== "damage" || !rollResult){
        return {success:false,reason:"Invalid damage RollRequest or RollResult"};
    }

    const validation = validateRollResult(request,rollResult);
    if(!validation.valid){
        return {success:false,reason:validation.reason};
    }

    if(!Number.isInteger(damageBonus)){
        return {success:false,reason:"Damage bonus must be an integer"};
    }

    const diceTotal = rollResult.results.reduce((sum,value) => sum + value,0);
    const rawDamage = Math.max(0,diceTotal + damageBonus);
    const mitigation = applyDamageMitigation(rawDamage,target,damageType);

    if(!mitigation.success){
        return mitigation;
    }

    return {
        success:true,
        diceTotal:diceTotal,
        damageBonus:damageBonus,
        rawDamage:rawDamage,
        finalDamage:mitigation.finalDamage,
        mitigation:mitigation.mitigation,
        damageType:normalizeDamageType(damageType)
    };
}


function commitDamage(target,resolvedDamage,options = {}){
    if(!target || !resolvedDamage || !resolvedDamage.success){
        return {success:false,reason:"Target and resolved damage are required"};
    }

    if(!Number.isInteger(target.hp) || !Number.isInteger(target.max_hp)){
        return {success:false,reason:"Target must have valid HP values"};
    }

    if(typeof ensureCreatureState !== "function"){
        return {success:false,reason:"Creature condition state engine is required"};
    }

    ensureCreatureState(target);

    const attackMode = options.attackMode || null;
    const knockOutRequested = options.knockOut === true;

    if(knockOutRequested && attackMode !== "melee"){
        return {success:false,reason:"Knock Out is only available for a melee attack"};
    }

    const previousHP = target.hp;
    const finalDamage = resolvedDamage.finalDamage;
    const reachesZero = previousHP > 0 && finalDamage >= previousHP;

    if(knockOutRequested && !reachesZero){
        return {success:false,reason:"Knock Out is only available when the damage would reduce the target to 0 HP"};
    }

    if(knockOutRequested && previousHP <= 0){
        return {success:false,reason:"Knock Out is not available for a target already at 0 HP"};
    }

    if(knockOutRequested){
        target.hp = 1;
        const state = setUnconscious(target,{stable:false});

        return {
            success:state.success,
            previousHP:previousHP,
            damage:finalDamage,
            currentHP:target.hp,
            lifeState:target.lifeState,
            stable:target.stable,
            conditions:[...target.conditions],
            knockedOut:true
        };
    }

    target.hp = Math.max(0,target.hp - finalDamage);

    let stateResult = null;

    if(target.hp === 0){
        const control = target.control || (target.faction === "player" ? "player" : "enemy");

        if(control === "player"){
            const remainingDamage = Math.max(0,finalDamage - previousHP);

            if(remainingDamage >= target.max_hp){
                stateResult = setDead(target);
            }else{
                stateResult = setUnconscious(target,{stable:false});
            }
        }else{
            stateResult = setDead(target);
        }
    }else if(target.lifeState === "unconscious"){
        stateResult = restoreFromZeroHP(target);
    }else{
        target.lifeState = "alive";
        target.stable = false;
    }

    if(stateResult && !stateResult.success){
        return {success:false,reason:stateResult.reason};
    }

    return {
        success:true,
        previousHP:previousHP,
        damage:finalDamage,
        currentHP:target.hp,
        lifeState:target.lifeState,
        stable:target.stable,
        conditions:[...target.conditions],
        knockedOut:false
    };
}
