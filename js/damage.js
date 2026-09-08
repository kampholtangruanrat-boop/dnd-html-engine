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


function commitDamage(target,resolvedDamage){
    if(!target || !resolvedDamage || !resolvedDamage.success){
        return {success:false,reason:"Target and resolved damage are required"};
    }

    if(!Number.isInteger(target.hp) || !Number.isInteger(target.max_hp)){
        return {success:false,reason:"Target must have valid HP values"};
    }

    const previousHP = target.hp;
    target.hp = Math.max(0,target.hp - resolvedDamage.finalDamage);

    return {
        success:true,
        previousHP:previousHP,
        damage:resolvedDamage.finalDamage,
        currentHP:target.hp
    };
}
