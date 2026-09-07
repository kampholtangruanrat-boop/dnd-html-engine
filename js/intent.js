const INTENT_TYPES = [
    "move",
    "action",
    "bonus_action",
    "reaction",
    "free_object_interaction",
    "compound",
    "end_turn"
];


function isNonEmptyString(value){
    return typeof value === "string" && value.length > 0;
}


function createIntent({
    intentId,
    actorId,
    type,
    payload = {},
    source = "player",
    rawText = null
}){

    const intent = {
        intentId:intentId,
        actorId:actorId,
        type:type,
        payload:payload,
        source:source,
        rawText:rawText,
        status:"pending"
    };

    const validation = validateIntent(intent);

    if(!validation.valid){
        return {
            success:false,
            intent:null,
            reason:validation.reason
        };
    }

    return {
        success:true,
        intent:intent
    };
}


function validateIntent(intent){

    if(!intent || typeof intent !== "object"){
        return {
            valid:false,
            reason:"Intent must be an object"
        };
    }

    if(!isNonEmptyString(intent.intentId)){
        return {
            valid:false,
            reason:"Intent requires intentId"
        };
    }

    if(!isNonEmptyString(intent.actorId)){
        return {
            valid:false,
            reason:"Intent requires actorId"
        };
    }

    if(!INTENT_TYPES.includes(intent.type)){
        return {
            valid:false,
            reason:"Intent has an unsupported type"
        };
    }

    if(!intent.payload || typeof intent.payload !== "object" || Array.isArray(intent.payload)){
        return {
            valid:false,
            reason:"Intent payload must be an object"
        };
    }

    if(intent.source !== "player" && intent.source !== "ai_dm"){
        return {
            valid:false,
            reason:"Intent source must be player or ai_dm"
        };
    }

    if(intent.status !== "pending"
        && intent.status !== "confirmed"
        && intent.status !== "rejected"
        && intent.status !== "resolved"){
        return {
            valid:false,
            reason:"Intent has invalid status"
        };
    }

    return {
        valid:true,
        reason:null
    };
}


function createConfirmationRequest({
    confirmationId,
    intent,
    question,
    choices = []
}){

    const intentValidation = validateIntent(intent);

    if(!intentValidation.valid){
        return {
            success:false,
            confirmation:null,
            reason:intentValidation.reason
        };
    }

    if(!isNonEmptyString(confirmationId)){
        return {
            success:false,
            confirmation:null,
            reason:"Confirmation requires confirmationId"
        };
    }

    if(!isNonEmptyString(question)){
        return {
            success:false,
            confirmation:null,
            reason:"Confirmation requires a question"
        };
    }

    if(!Array.isArray(choices)){
        return {
            success:false,
            confirmation:null,
            reason:"Confirmation choices must be an array"
        };
    }

    return {
        success:true,
        confirmation:{
            confirmationId:confirmationId,
            intentId:intent.intentId,
            intent:intent,
            question:question,
            choices:[...choices],
            status:"pending"
        }
    };
}


function setPendingConfirmation(state,confirmation){

    if(!state || typeof state !== "object"){
        return {
            success:false,
            state:state,
            reason:"State is required"
        };
    }

    if(!confirmation || confirmation.status !== "pending"){
        return {
            success:false,
            state:state,
            reason:"A pending confirmation is required"
        };
    }

    state.pendingConfirmation = confirmation;

    return {
        success:true,
        state:state,
        pendingConfirmation:confirmation
    };
}


function confirmPendingIntent(state,confirmationId,selection = null){

    if(!state || !state.pendingConfirmation){
        return {
            success:false,
            state:state,
            reason:"No pending confirmation"
        };
    }

    const confirmation = state.pendingConfirmation;

    if(confirmation.confirmationId !== confirmationId){
        return {
            success:false,
            state:state,
            reason:"Unknown confirmation ID"
        };
    }

    if(confirmation.choices.length > 0){
        if(selection === null || !confirmation.choices.includes(selection)){
            return {
                success:false,
                state:state,
                reason:"Confirmation selection is not one of the available choices"
            };
        }
    }

    const confirmedIntent = {
        ...confirmation.intent,
        status:"confirmed",
        confirmationSelection:selection
    };

    state.pendingConfirmation = null;

    return {
        success:true,
        state:state,
        intent:confirmedIntent
    };
}


function rejectPendingIntent(state,confirmationId){

    if(!state || !state.pendingConfirmation){
        return {
            success:false,
            state:state,
            reason:"No pending confirmation"
        };
    }

    if(state.pendingConfirmation.confirmationId !== confirmationId){
        return {
            success:false,
            state:state,
            reason:"Unknown confirmation ID"
        };
    }

    const rejectedIntent = {
        ...state.pendingConfirmation.intent,
        status:"rejected"
    };

    state.pendingConfirmation = null;

    return {
        success:true,
        state:state,
        intent:rejectedIntent
    };
}
