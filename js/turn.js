function getAbilityModifier(score){

    return Math.floor((score - 10) / 2);
}


function getInitiativeModifier(character){

    if(!character || !character.abilities){
        return 0;
    }

    if(typeof character.initiativeModifier === "number"){
        return character.initiativeModifier;
    }

    return getAbilityModifier(character.abilities.dex);
}


function getCombatantControl(character){

    if(!character){
        return "unknown";
    }

    if(character.control === "player" || character.control === "enemy"){
        return character.control;
    }

    if(character.faction === "player"){
        return "player";
    }

    return "enemy";
}


function getInitiativeGroupId(character){

    if(!character){
        return null;
    }

    if(character.initiativeGroupId){
        return character.initiativeGroupId;
    }

    return null;
}


function createRollRequestId(state,index){

    return `initiative-${state.combatId}-${index + 1}`;
}


function createInitiativeRollRequests(state,characters){

    const requests = [];
    const groupedEnemyRequests = {};

    characters.forEach(character => {

        const control = getCombatantControl(character);
        const groupId = getInitiativeGroupId(character);

        if(control === "enemy" && groupId){

            if(groupedEnemyRequests[groupId]){
                return;
            }

            const created = createRollRequest({
                rollId:createRollRequestId(state,requests.length),
                actorId:groupId,
                control:"enemy",
                type:"initiative",
                dice:{count:1,sides:20},
                mode:"normal",
                source:"python_rng"
            });

            if(!created.success){
                return;
            }

            groupedEnemyRequests[groupId] = created.request.rollId;
            requests.push(created.request);
            return;
        }

        const created = createRollRequest({
            rollId:createRollRequestId(state,requests.length),
            actorId:character.id,
            control:control,
            type:"initiative",
            dice:{count:1,sides:20},
            mode:"normal",
            source:control === "player" ? "player" : "python_rng"
        });

        if(created.success){
            requests.push(created.request);
        }
    });

    state.pendingRolls = requests;
    return requests;
}


function createCombatState(characters,options = {}){

    if(!Array.isArray(characters) || characters.length === 0){
        return {
            success:false,
            state:null
        };
    }

    const combatId =
        options.combatId || `combat-${Date.now()}`;

    const state = {
        combatId:combatId,
        active:true,
        phase:"initiative_pending",
        round:0,
        turnIndex:-1,
        initiative:[],
        combatants:characters.map(character => ({
            characterId:character.id,
            control:getCombatantControl(character),
            initiativeGroupId:getInitiativeGroupId(character),
            initiativeModifier:getInitiativeModifier(character),
            initiativeRoll:null,
            initiativeTotal:null,
            surprised:false
        })),
        pendingRolls:[],
        pendingConfirmation:null,
        pendingReaction:null,
        eventSequence:0
    };

    createInitiativeRollRequests(state,characters);

    return {
        success:true,
        state:state
    };
}


function initializeCombat(characters,options = {}){

    return createCombatState(characters,options);
}


function getPendingRoll(state,rollId){

    if(!state || !Array.isArray(state.pendingRolls)){
        return null;
    }

    return state.pendingRolls.find(roll => roll.rollId === rollId) || null;
}


function resolveInitiativeRoll(request,result){

    if(!request || request.type !== "initiative" || !result){
        return {
            success:false,
            reason:"Invalid initiative RollRequest or RollResult"
        };
    }

    if(!Array.isArray(result.results) || result.results.length !== request.dice.count){
        return {
            success:false,
            reason:"Incorrect number of dice results"
        };
    }

    let selected = result.results[0];

    if(request.mode === "advantage"){
        selected = Math.max(...result.results);
    }

    if(request.mode === "disadvantage"){
        selected = Math.min(...result.results);
    }

    return {
        success:true,
        selected:selected,
        results:[...result.results]
    };
}


function submitInitiativeRoll(state,rollId,rollResult,characters){

    if(!state || state.phase !== "initiative_pending"){
        return {
            success:false,
            state:state,
            reason:"Initiative rolls are not pending"
        };
    }

    const request = getPendingRoll(state,rollId);

    if(!request){
        return {
            success:false,
            state:state,
            reason:"Unknown roll request"
        };
    }

    if(request.type !== "initiative"){
        return {
            success:false,
            state:state,
            reason:"RollRequest is not an initiative request"
        };
    }

    const submission = submitRollResult(state,rollResult);

    if(!submission.success){
        return {
            success:false,
            state:state,
            reason:submission.reason
        };
    }

    const resolved = resolveInitiativeRoll(request,rollResult);

    if(!resolved.success){
        return {
            success:false,
            state:state,
            reason:resolved.reason
        };
    }

    const groupId = request.actorId;
    const combatants = state.combatants.filter(combatant => {
        if(request.control === "enemy" && groupId){
            return combatant.initiativeGroupId === groupId;
        }

        return combatant.characterId === request.actorId;
    });

    if(combatants.length === 0){
        request.status = "pending";
        delete request.results;
        return {
            success:false,
            state:state,
            reason:"No combatant matches roll request"
        };
    }

    combatants.forEach(combatant => {
        combatant.initiativeRoll = resolved.selected;
        combatant.initiativeTotal =
            resolved.selected + combatant.initiativeModifier;
    });

    return {
        success:true,
        state:state,
        allRollsResolved:submission.allRollsResolved,
        result:resolved
    };
}


function getInitiativeTieGroups(state){

    const byTotal = {};

    state.combatants.forEach(combatant => {

        if(combatant.initiativeTotal === null){
            return;
        }

        if(!byTotal[combatant.initiativeTotal]){
            byTotal[combatant.initiativeTotal] = [];
        }

        byTotal[combatant.initiativeTotal].push(combatant);
    });

    return Object.entries(byTotal)
        .filter(([,group]) => group.length > 1)
        .map(([total,group]) => ({
            total:Number(total),
            combatants:group
        }));
}


function validateTieBreakerOrder(group,orderIds){

    if(!Array.isArray(orderIds) || orderIds.length !== group.combatants.length){
        return false;
    }

    const expected = group.combatants
        .map(combatant => combatant.characterId)
        .sort();

    const received = [...orderIds].sort();

    return expected.every((id,index) => id === received[index]);
}


function buildInitiativeOrder(state,tieBreakers = {},characters = null){

    if(!state || state.phase !== "initiative_pending"){
        return {
            success:false,
            state:state,
            reason:"Initiative is not pending"
        };
    }

    if(!state.pendingRolls.length || state.pendingRolls.some(request => request.status !== "resolved")){
        return {
            success:false,
            state:state,
            reason:"All initiative RollRequests must be resolved before initiative can be finalized"
        };
    }

    const tieGroups = getInitiativeTieGroups(state);

    for(const group of tieGroups){

        const key = String(group.total);
        const order = tieBreakers[key];

        if(!validateTieBreakerOrder(group,order)){
            return {
                success:false,
                state:state,
                status:"needs_tiebreak",
                reason:"Initiative tie requires an explicit order",
                tieGroups:tieGroups
            };
        }
    }

    const tieRank = {};

    Object.entries(tieBreakers).forEach(([,ids]) => {
        ids.forEach((id,index) => {
            tieRank[id] = index;
        });
    });

    state.initiative =
        state.combatants
            .slice()
            .sort((a,b) => {

                if(b.initiativeTotal !== a.initiativeTotal){
                    return b.initiativeTotal - a.initiativeTotal;
                }

                const aRank =
                    tieRank[a.characterId] ?? Number.MAX_SAFE_INTEGER;
                const bRank =
                    tieRank[b.characterId] ?? Number.MAX_SAFE_INTEGER;

                return aRank - bRank;
            })
            .map((combatant,index) => ({
                characterId:combatant.characterId,
                initiativeRoll:combatant.initiativeRoll,
                total:combatant.initiativeTotal,
                order:index
            }));

    state.pendingRolls = [];
    state.phase = "turn";
    state.round = 1;
    state.turnIndex = 0;

    const turnStart = characters ? beginTurn(state,characters) : {
        success:true
    };

    if(!turnStart.success){
        return {
            success:false,
            state:state,
            reason:"Initiative finalized but the first turn could not be started"
        };
    }

    return {
        success:true,
        state:state,
        character:turnStart.character || null
    };
}


function finalizeInitiative(state,characters,tieBreakers = {}){

    return buildInitiativeOrder(state,tieBreakers,characters);
}


function beginTurn(state,characters){

    if(!state || !state.active || state.phase !== "turn" || !state.initiative.length){
        return {
            success:false,
            character:null
        };
    }

    const entry = state.initiative[state.turnIndex];

    if(!entry){
        return {
            success:false,
            character:null
        };
    }

    const character =
        characters.find(character => character.id === entry.characterId);

    if(!character){
        return {
            success:false,
            character:null
        };
    }

    resetTurnResources(character);

    return {
        success:true,
        character:character
    };
}


function advanceTurn(state,characters){

    if(!state || !state.active || state.phase !== "turn" || !state.initiative.length){
        return {
            success:false,
            state:state,
            previousCharacterId:null
        };
    }

    const currentEntry = state.initiative[state.turnIndex];
    const previousCharacterId = currentEntry.characterId;

    state.turnIndex += 1;

    if(state.turnIndex >= state.initiative.length){
        state.turnIndex = 0;
        state.round += 1;
    }

    const result = beginTurn(state,characters);

    if(!result.success){
        return {
            success:false,
            state:state,
            previousCharacterId:previousCharacterId
        };
    }

    return {
        success:true,
        state:state,
        previousCharacterId:previousCharacterId,
        character:result.character
    };
}


function getCurrentTurnCharacter(state,characters){

    if(!state || !state.active || state.phase !== "turn" || !state.initiative.length){
        return null;
    }

    const entry = state.initiative[state.turnIndex];

    if(!entry){
        return null;
    }

    return characters.find(character => character.id === entry.characterId) || null;
}


function endCombat(state){

    if(!state){
        return {
            success:false,
            state:state
        };
    }

    state.active = false;
    state.phase = "ended";
    state.pendingRolls = [];
    state.pendingConfirmation = null;
    state.pendingReaction = null;

    return {
        success:true,
        state:state
    };
}


function resetTurnResources(character){

    if(!character || !character.movement){
        return {
            success:false
        };
    }

    character.movement.remaining =
        character.movement.types.walk;

    character.movement.spent = 0;

    character.turnResources = {
        actionUsed:false,
        bonusActionUsed:false,
        reactionUsed:false
    };

    return {
        success:true
    };
}


function useAction(character){

    if(!character){
        return false;
    }

    if(!character.turnResources){
        resetTurnResources(character);
    }

    if(character.turnResources.actionUsed){
        return false;
    }

    character.turnResources.actionUsed = true;
    return true;
}


function useBonusAction(character){

    if(!character){
        return false;
    }

    if(!character.turnResources){
        resetTurnResources(character);
    }

    if(character.turnResources.bonusActionUsed){
        return false;
    }

    character.turnResources.bonusActionUsed = true;
    return true;
}


function useReaction(character){

    if(!character){
        return false;
    }

    if(!character.turnResources){
        resetTurnResources(character);
    }

    if(character.turnResources.reactionUsed){
        return false;
    }

    character.turnResources.reactionUsed = true;
    return true;
}
