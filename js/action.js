const RESOLUTION_INTENT_TYPES = [
    "action",
    "bonus_action",
    "reaction",
    "end_turn"
];


function findCombatantById(state,actorId){

    if(!state || !Array.isArray(state.combatants) || typeof actorId !== "string"){
        return null;
    }

    return state.combatants.find(combatant =>
        combatant.characterId === actorId
    ) || null;
}


function getCurrentActorId(state){

    if(!state || state.phase !== "turn" || !Array.isArray(state.initiative)){
        return null;
    }

    const entry = state.initiative[state.turnIndex];

    return entry ? entry.characterId : null;
}


function getCharacterById(characters,actorId){

    if(!Array.isArray(characters) || typeof actorId !== "string"){
        return null;
    }

    return characters.find(character => character.id === actorId) || null;
}


function getActionResource(type){

    if(type === "action"){
        return "action";
    }

    if(type === "bonus_action"){
        return "bonus_action";
    }

    if(type === "reaction"){
        return "reaction";
    }

    return null;
}


function validateActionIntent(state,characters,intent){

    if(!state || !state.active){
        return {
            valid:false,
            reason:"Combat is not active"
        };
    }

    if(state.phase !== "turn"){
        return {
            valid:false,
            reason:"Actions can only be resolved during the turn phase"
        };
    }

    if(!intent || typeof intent !== "object"){
        return {
            valid:false,
            reason:"Action intent is required"
        };
    }

    if(intent.status !== "confirmed"){
        return {
            valid:false,
            reason:"Action intent must be confirmed before resolution"
        };
    }

    if(!RESOLUTION_INTENT_TYPES.includes(intent.type)){
        return {
            valid:false,
            reason:"Intent type is not supported by the action resolver"
        };
    }

    if(typeof intent.actorId !== "string" || intent.actorId.length === 0){
        return {
            valid:false,
            reason:"Action intent requires actorId"
        };
    }

    if(getCurrentActorId(state) !== intent.actorId){
        return {
            valid:false,
            reason:"Only the current turn actor can resolve this intent"
        };
    }

    const combatant = findCombatantById(state,intent.actorId);
    const character = getCharacterById(characters,intent.actorId);

    if(!combatant || !character){
        return {
            valid:false,
            reason:"Intent actor is not a current combatant"
        };
    }

    if(intent.type === "end_turn"){
        return {
            valid:true,
            reason:null,
            resource:null,
            actionId:null,
            combatant:combatant,
            character:character
        };
    }

    if(!intent.payload
        || typeof intent.payload !== "object"
        || Array.isArray(intent.payload)){
        return {
            valid:false,
            reason:"Action intent payload must be an object"
        };
    }

    if(typeof intent.payload.actionId !== "string"
        || intent.payload.actionId.length === 0){
        return {
            valid:false,
            reason:"Action intent requires payload.actionId"
        };
    }

    const resource = getActionResource(intent.type);

    if(!resource){
        return {
            valid:false,
            reason:"Action intent has no resolvable resource"
        };
    }

    if(!character.turnResources){
        return {
            valid:false,
            reason:"Actor turn resources are not initialized"
        };
    }

    const usedField = `${resource === "action" ? "action" : resource === "bonus_action" ? "bonusAction" : "reaction"}Used`;

    if(character.turnResources[usedField]){
        return {
            valid:false,
            reason:`${resource} has already been used this turn`
        };
    }

    return {
        valid:true,
        reason:null,
        resource:resource,
        actionId:intent.payload.actionId,
        combatant:combatant,
        character:character
    };
}


function createActionResolutionPlan(state,characters,intent){

    const validation = validateActionIntent(state,characters,intent);

    if(!validation.valid){
        return {
            success:false,
            plan:null,
            reason:validation.reason
        };
    }

    return {
        success:true,
        plan:{
            intentId:intent.intentId,
            actorId:intent.actorId,
            type:intent.type,
            actionId:validation.actionId,
            resource:validation.resource
        }
    };
}


function commitActionResolution(state,characters,intent,plan){

    if(!state || !Array.isArray(state.initiative)){
        return {
            success:false,
            state:state,
            intent:intent,
            reason:"Combat state is required"
        };
    }

    if(!plan
        || plan.intentId !== intent.intentId
        || plan.actorId !== intent.actorId
        || plan.type !== intent.type){
        return {
            success:false,
            state:state,
            intent:intent,
            reason:"Action resolution plan does not match intent"
        };
    }

    const validation = validateActionIntent(state,characters,intent);

    if(!validation.valid){
        return {
            success:false,
            state:state,
            intent:intent,
            reason:validation.reason
        };
    }

    if(validation.resource !== plan.resource
        || validation.actionId !== plan.actionId){
        return {
            success:false,
            state:state,
            intent:intent,
            reason:"Action resolution plan is stale"
        };
    }

    if(intent.type === "end_turn"){
        const previousCharacterId = intent.actorId;
        const result = advanceTurn(state,characters);

        if(!result.success){
            return {
                success:false,
                state:state,
                intent:intent,
                reason:"Failed to advance turn"
            };
        }

        return {
            success:true,
            state:state,
            intent:{...intent,status:"resolved"},
            resolution:plan,
            previousCharacterId:previousCharacterId,
            character:result.character
        };
    }

    const character = validation.character;

    if(plan.resource === "action"){
        if(!useAction(character)){
            return {
                success:false,
                state:state,
                intent:intent,
                reason:"Action resource could not be consumed"
            };
        }
    }

    if(plan.resource === "bonus_action"){
        if(!useBonusAction(character)){
            return {
                success:false,
                state:state,
                intent:intent,
                reason:"Bonus Action resource could not be consumed"
            };
        }
    }

    if(plan.resource === "reaction"){
        if(!useReaction(character)){
            return {
                success:false,
                state:state,
                intent:intent,
                reason:"Reaction resource could not be consumed"
            };
        }
    }

    return {
        success:true,
        state:state,
        intent:{...intent,status:"resolved"},
        resolution:plan,
        character:character
    };
}


function resolveActionIntent(state,characters,intent){

    const planned = createActionResolutionPlan(state,characters,intent);

    if(!planned.success){
        return {
            success:false,
            state:state,
            intent:intent,
            reason:planned.reason
        };
    }

    return commitActionResolution(
        state,
        characters,
        intent,
        planned.plan
    );
}
