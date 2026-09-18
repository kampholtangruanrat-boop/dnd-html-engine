const CONDITION_EFFECTS = Object.freeze({
    unconscious: Object.freeze({
        implies:["incapacitated","prone"],
        speedZero:true,
        attackRollsAgainstAdvantage:true,
        strengthDexteritySavesAutoFail:true
    }),
    incapacitated: Object.freeze({
        actionUnavailable:true,
        bonusActionUnavailable:true,
        reactionUnavailable:true,
        speechless:true
    }),
    prone: Object.freeze({
        crawlOnly:true,
        attackRollsDisadvantage:true,
        meleeAttacksAgainstAdvantage:true
    })
});

function ensureCreatureState(creature){
    if(!creature){
        return null;
    }

    if(!Array.isArray(creature.conditions)){
        creature.conditions = [];
    }

    if(typeof creature.lifeState !== "string"){
        creature.lifeState = Number(creature.hp) <= 0 ? "unconscious" : "alive";
    }

    if(typeof creature.stable !== "boolean"){
        creature.stable = false;
    }

    if(!creature.deathSaves || typeof creature.deathSaves !== "object"){
        creature.deathSaves = {successes:0,failures:0};
    }

    return creature;
}

function hasCondition(creature,condition){
    ensureCreatureState(creature);
    return creature.conditions.includes(condition);
}

function addCondition(creature,condition){
    ensureCreatureState(creature);

    if(typeof condition !== "string" || condition.trim() === ""){
        return {success:false,reason:"Condition name is required"};
    }

    const normalized = condition.trim().toLowerCase();

    if(!creature.conditions.includes(normalized)){
        creature.conditions.push(normalized);
    }

    if(normalized === "unconscious"){
        addCondition(creature,"incapacitated");
        addCondition(creature,"prone");
        creature.lifeState = "unconscious";
    }

    return {
        success:true,
        condition:normalized,
        conditions:[...creature.conditions]
    };
}

function removeCondition(creature,condition){
    ensureCreatureState(creature);

    const normalized = typeof condition === "string"
        ? condition.trim().toLowerCase()
        : "";

    creature.conditions = creature.conditions.filter(item => item !== normalized);

    if(normalized === "unconscious"){
        // The 2024 rules explicitly state that when Unconscious ends,
        // the creature remains Prone. Incapacitated is an implied effect
        // of Unconscious and therefore ends with it.
        creature.conditions = creature.conditions.filter(item =>
            item !== "incapacitated"
        );

        if(creature.lifeState === "unconscious"){
            creature.lifeState = Number(creature.hp) > 0 ? "alive" : "alive";
        }
        creature.stable = false;
    }

    return {
        success:true,
        condition:normalized,
        conditions:[...creature.conditions]
    };
}

function setDead(creature){
    ensureCreatureState(creature);

    creature.hp = 0;
    creature.lifeState = "dead";
    creature.stable = false;
    creature.conditions = creature.conditions.filter(item =>
        item !== "unconscious" && item !== "incapacitated"
    );

    return {success:true,lifeState:"dead",conditions:[...creature.conditions]};
}

function setUnconscious(creature,{stable=false} = {}){
    ensureCreatureState(creature);

    creature.lifeState = "unconscious";
    creature.stable = Boolean(stable);
    addCondition(creature,"unconscious");

    return {
        success:true,
        lifeState:creature.lifeState,
        stable:creature.stable,
        conditions:[...creature.conditions]
    };
}

function setStable(creature){
    ensureCreatureState(creature);

    if(Number(creature.hp) !== 0){
        return {success:false,reason:"Only a creature at 0 HP can be Stable"};
    }

    creature.lifeState = "unconscious";
    creature.stable = true;
    addCondition(creature,"unconscious");

    return {success:true,lifeState:"unconscious",stable:true};
}

function restoreFromZeroHP(creature){
    ensureCreatureState(creature);

    if(Number(creature.hp) <= 0){
        return {success:false,reason:"Creature must regain HP before leaving the 0 HP state"};
    }

    creature.stable = false;
    creature.deathSaves = {successes:0,failures:0};
    removeCondition(creature,"unconscious");
    creature.lifeState = "alive";

    return {success:true,lifeState:"alive"};
}

function getCreatureStatus(creature){
    ensureCreatureState(creature);

    return {
        lifeState:creature.lifeState,
        stable:creature.stable,
        conditions:[...creature.conditions],
        deathSaves:{...creature.deathSaves}
    };
}
