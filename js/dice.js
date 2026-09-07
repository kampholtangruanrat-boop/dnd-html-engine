function isValidDice(dice){

    return !!dice
        && Number.isInteger(dice.count)
        && dice.count > 0
        && Number.isInteger(dice.sides)
        && dice.sides >= 2;
}


function isValidRollMode(mode){

    return mode === "normal"
        || mode === "advantage"
        || mode === "disadvantage";
}


function isValidRollSource(source){

    return source === "player"
        || source === "python_rng";
}


function createRollRequest({
    rollId,
    actorId,
    control,
    type,
    dice,
    mode = "normal",
    source
}){

    const request = {
        rollId:rollId,
        actorId:actorId,
        control:control,
        type:type,
        dice:{
            count:dice.count,
            sides:dice.sides
        },
        mode:mode,
        source:source,
        status:"pending"
    };

    const validation =
        validateRollRequest(request);

    if(!validation.valid){
        return {
            success:false,
            request:null,
            reason:validation.reason
        };
    }

    return {
        success:true,
        request:request
    };
}


function validateRollRequest(request){

    if(!request || typeof request !== "object"){
        return {
            valid:false,
            reason:"RollRequest must be an object"
        };
    }

    if(typeof request.rollId !== "string" || request.rollId.length === 0){
        return {
            valid:false,
            reason:"RollRequest requires rollId"
        };
    }

    if(typeof request.actorId !== "string" || request.actorId.length === 0){
        return {
            valid:false,
            reason:"RollRequest requires actorId"
        };
    }

    if(typeof request.control !== "string" || request.control.length === 0){
        return {
            valid:false,
            reason:"RollRequest requires control"
        };
    }

    if(typeof request.type !== "string" || request.type.length === 0){
        return {
            valid:false,
            reason:"RollRequest requires type"
        };
    }

    if(!isValidDice(request.dice)){
        return {
            valid:false,
            reason:"RollRequest has invalid dice"
        };
    }

    if(!isValidRollMode(request.mode)){
        return {
            valid:false,
            reason:"RollRequest has invalid roll mode"
        };
    }

    if(!isValidRollSource(request.source)){
        return {
            valid:false,
            reason:"RollRequest has invalid roll source"
        };
    }

    if(request.control === "player" && request.source !== "player"){
        return {
            valid:false,
            reason:"Player RollRequest must use player source"
        };
    }

    if(request.control === "enemy" && request.source !== "python_rng"){
        return {
            valid:false,
            reason:"Enemy RollRequest must use python_rng source"
        };
    }

    if(request.status !== "pending" && request.status !== "resolved"){
        return {
            valid:false,
            reason:"RollRequest has invalid status"
        };
    }

    return {
        valid:true,
        reason:null
    };
}


function getRollRequest(state,rollId){

    if(!state || !Array.isArray(state.pendingRolls)){
        return null;
    }

    return state.pendingRolls.find(request => request.rollId === rollId) || null;
}


function validateRollResult(request, result){

    if(!request || request.status !== "pending"){
        return {
            valid:false,
            reason:"RollRequest is not pending"
        };
    }

    if(!result || typeof result !== "object"){
        return {
            valid:false,
            reason:"RollResult must be an object"
        };
    }

    if(result.rollId !== request.rollId){
        return {
            valid:false,
            reason:"RollResult rollId does not match RollRequest"
        };
    }

    if(result.source !== request.source){
        return {
            valid:false,
            reason:"RollResult source does not match RollRequest"
        };
    }

    if(!Array.isArray(result.results)
        || result.results.length !== request.dice.count){
        return {
            valid:false,
            reason:"RollResult has incorrect number of dice results"
        };
    }

    if(!result.results.every(value =>
        Number.isInteger(value)
        && value >= 1
        && value <= request.dice.sides
    )){
        return {
            valid:false,
            reason:"RollResult contains an invalid die result"
        };
    }

    return {
        valid:true,
        reason:null
    };
}


function submitRollResult(state,result){

    if(!state || !Array.isArray(state.pendingRolls)){
        return {
            success:false,
            state:state,
            reason:"State has no pending rolls"
        };
    }

    const request =
        getRollRequest(state,result && result.rollId);

    if(!request){
        return {
            success:false,
            state:state,
            reason:"Unknown RollRequest"
        };
    }

    const validation =
        validateRollResult(request,result);

    if(!validation.valid){
        return {
            success:false,
            state:state,
            reason:validation.reason
        };
    }

    request.status = "resolved";
    request.results = [...result.results];

    if(result.selected !== undefined){
        request.selected = result.selected;
    }

    return {
        success:true,
        state:state,
        rollRequest:request,
        allRollsResolved:state.pendingRolls.every(item => item.status === "resolved")
    };
}


function clearResolvedRolls(state){

    if(!state || !Array.isArray(state.pendingRolls)){
        return {
            success:false,
            state:state
        };
    }

    state.pendingRolls =
        state.pendingRolls.filter(request => request.status !== "resolved");

    return {
        success:true,
        state:state
    };
}
