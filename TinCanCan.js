
/* 
=============COPYRIGHT============ 
Tin Can-Can - A Tin Can API wrapper for Adobe Captivate
Copyright (C) 2012  Andrew Downes

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, version 3.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.
<http://www.gnu.org/licenses/>.
*/



/*============SWF EMBED VARIABLES==============*/
var strURLParams = "?SCORM_API=1.0&SCORM_TYPE=0",
flashvars = {},
params = { wmode: "opaque", allowScriptAccess: "always", bgcolor: "#f5f4f1", menu: "false" },
attributes = { id: "Captivate", name: "Captivate" }; 
//Handler for the Captivate swf element
/*============END SWF EMBED VARIABLES==============*/


/*============OTHER GLOBAL VARIABLES==============*/
var value_store = {}, //stores values such as score so that data is only sent to the LMS when it has chnaged. 
attemptInProgress = false, //value currently sent to LRS
attemptCompleted = false, //value currently sent to LRS
completionChanged = false, //used to track if the completion status has been chnaged but not yet reported. 
startDuration; //the attempt duration at the start of the session
/*============END OTHER GLOBAL VARIABLES==============*/
//TinCan.DEBUG = true;
//Create an instance of the Tin Can Library
var myTinCan = new TinCan();

/*============CREATE LRS OBJECT==============*/

//get the array of LRSes from the query string
var LRSArray = getObjectFromQueryString('lrs');

//For each LRS in that array...
$.each(LRSArray,function(index){
	//...make a new LRS object (some reformatting required)...
	var myLRS = new TinCan.LRS({
		endpoint: LRSArray[index].endpoint, 
		version: "0.95",
		auth: 'Basic ' + Base64.encode(LRSArray[index].login + ':' + LRSArray[index].pass)
	});
	//...and add it to the Tin Can Object's library of record stores
	myTinCan.recordStores[index] = myLRS;
});

/*============END CREATE LRS OBJECT==============*/

/*============CREATE ACTOR OBJECT==============*/

//Get the actor object from the querystring and use it to define a TinCan Agent
var myActor= new TinCan.Agent(getObjectFromQueryString('actor'));
//Tell the Tin Can driver to use this agent (TODO: test what this actually does i.e. does it affect authority or is it just a default?)
myTinCan.actor = myActor;

/*============END CREATE ACTOR OBJECT==============*/

/*============CREATE THE ACTIVTY OBJECT==============*/
//TODO: PULL THESE VALUES FROM XML OR SOMETHING 
//TODO: Add support for multiple languages
var courseName = "Name of Captivate Course in trans-Atlantic English";
var courseDesc = "Description of Captivate Course in trans-Atlantic English";
var courseId = "http://example.com/exampleCaptivate";
//END Pull for XML


//Create the activity definition
var captivateActivityDefinition = new TinCan.ActivityDefinition({
	type : "http://adlnet.gov/expapi/activities/course",
	name:  {
		"en-US" : courseName,
		"en-GB" : courseName
	},
	description: {
		"en-US" : courseDesc,
		"en-GB" : courseDesc
	},
});

//Create the activity
var myActivity = new TinCan.Activity({
	id : courseId,
	definition : captivateActivityDefinition
});

//Tell the Tin Can driver to use this activity as default
myTinCan.activity = myActivity;

/*============END CREATE THE ACTIVTY OBJECT==============*/

//TODO: ADD CONTEXT TO INCLUDE REVISION AND REGISTRATION AS A MINIMUM

/*============CREATE PREDEFINED STATEMENT TEMPLATES==============*/



//Declare statement Collection as a new Object to hold our template statements
var statementsCollection = new Object();

//For each verb, create an instance of the Tin Can Verb Object and add it to the collection for later use. 

//attempted - an attempt has happened but the session ended before it was completed. 
statementsCollection.attempted =  makeTemplateStatement();
statementsCollection.attempted.verb = getVerb("attempted", "http://adlnet.gov/expapi/verbs/");
statementsCollection.attempted.result=getResult(false);

//completed - an attempted has been completed but we are making no assertions as to whether it was successful or not
statementsCollection.completed = makeTemplateStatement();
statementsCollection.completed.verb = getVerb("completed", "http://adlnet.gov/expapi/verbs/");
statementsCollection.completed.result =getResult(true);

//passed - an attempt has been completed successfully
statementsCollection.passed = makeTemplateStatement();
statementsCollection.passed.verb = getVerb("passed", "http://adlnet.gov/expapi/verbs/");
statementsCollection.passed.result = getResult(true, true);

//failed - an attempt has been completed but it was not sucecssful
statementsCollection.failed = makeTemplateStatement();
statementsCollection.failed.verb = getVerb("failed", "http://adlnet.gov/expapi/verbs/");
statementsCollection.failed.result = getResult(true, false);

//started - A session started
statementsCollection.started = makeTemplateStatement();
statementsCollection.started.verb = getVerb("started", "http://www.tincanapi.co.uk/wiki/verbs:");


//stopped - A session ended
statementsCollection.stopped = makeTemplateStatement();
statementsCollection.stopped.verb = getVerb("stopped", "http://www.tincanapi.co.uk/wiki/verbs:");


/*============END=============*/

/*============SET STATE SETTINGS==============*/
var stateCfg = {
	actor: myActor,
	activity: myActivity,
	registration: '55da1b40-4181-11e2-a25f-0800200c9a66' 
	//Note this unique UUID was generated by a UUID gentator so is and always will be unique. What? You wanted a DIFFERRENT unique number every time?
	//TODO: put registration UUID in querystring and in Statement Context
}

TCCGetState();

/*============END=============*/

/*============CREATE CMI CACHE==============*/
var cmiCacheResultChanged = false; //if true, we have new data to send to the LRS
var cmiCache = function(property, value){

	//Ensure we have a valid property to work with
	if(typeof property === "undefined"){ return false; }

	//Replace all periods in CMI property names so we don't run into JS errors
	property = property.replace(/\./g,'_');

	//If cached value exists, return it
	if(typeof value_store[property] !== "undefined"){
		return value_store[property];
	}

	//Otherwise add to cache
	if(typeof value !== "undefined"){
		value_store[property] = value;
	}

	return false;

};
/*============END CREATE CMI CACHE==============*/



$(function(){
	
	/*============LAUNCH CODE==============*/
	
	//Get the duration from the state if it exists (default "" which we interpret as "PT0H0M0S") and save it for later comparision. 
	startDuration = value_store["cmi.total_time"]; //must be called AFTER the LRS object has been created 

	myTinCan.sendStatement(statementsCollection.started, function() {});
	

	/*============END LAUNCH CODE==============*/
		
});
/*===========================================FUNCTIONS ONLY PAST THIS POINT========================================================*/


function makeTemplateStatement()
{
	//create a base statement
	return  new TinCan.Statement({
		actor : myActor,
		target : myActivity
	},true);
}

function getResult(completion,success)
{
	
	if (typeof success == 'undefined')
	{
		return new TinCan.Result({
			completion : completion,
		});
	}
	else
	{
		return new TinCan.Result({
			completion : completion,
			success : success
		});
	}
}

function getVerb(verb, library, display)
{
	display = typeof display == 'undefined' ? verb : display;
	return new TinCan.Verb({
		id : library + verb,
		display : {
			"en-US" : display,
			"en-GB" : display
		}
	});
}


function getObjectFromQueryString(objectToGet)
{
	var qString = $.getUrlVar(objectToGet);
	
	if (!(qString == undefined))
	{
		var objectToReturn = JSON.parse(urldecode(qString));
		return objectToReturn;
	}
	else
	{
		return;
	}
}



/*============DURATION FUNCTIONS==============*/
function convertCMITimespanToSeconds(CMITimespan)
{
	var indexOfPT = CMITimespan.indexOf("PT");
	var indexOfH = CMITimespan.indexOf("H");
	var indexOfM = CMITimespan.indexOf("M");
	var indexOfS = CMITimespan.indexOf("S");
	
	var hours;
	var minutes;
	var seconds;
	
	if (indexOfH == -1) {
		indexOfH = indexOfPT + 1;
		hours = 0;
		}
		else {
		hours = parseInt(CMITimespan.slice(indexOfPT + 2, indexOfH));	
		};
		
	if (indexOfM == -1) {
		indexOfM = indexOfPT + 1
		minutes = 0;
		}
		else
		{
		minutes = parseInt(CMITimespan.slice(indexOfH + 1, indexOfM));
		};
	
	seconds = parseInt(CMITimespan.slice(indexOfM + 1, indexOfS));
	
	var timespanInSeconds = parseInt((((hours * 60) + minutes) * 60) + seconds);
	if (isNaN(timespanInSeconds)){timespanInSeconds=0};
	return timespanInSeconds;
}

function convertSecondsToCMITimespan(inputSeconds)
{
	var hours, minutes, seconds, 
	i_inputSeconds = parseInt(inputSeconds);
	hours = parseInt((i_inputSeconds) / 3600);
	minutes = parseInt(((i_inputSeconds) % 3600) / 60);
	seconds = parseInt(((i_inputSeconds) % 3600) % 60);
	return "PT"+ hours +"H"+ minutes +"M"+ seconds +"S";
}

function addDurations(value_one,value_two)
{
	var duration = convertSecondsToCMITimespan(convertCMITimespanToSeconds(value_one) + convertCMITimespanToSeconds(value_two));
	compareWithCacheAndSetState("cmi.total_time",duration,true)
	return duration;
}

function diffDurations(largeValue,smallValue)
{
	var duration = convertSecondsToCMITimespan(convertCMITimespanToSeconds(largeValue) - convertCMITimespanToSeconds(smallValue));
	return duration
}

function resetClock() //reset the duration timer to zero
{
	myTinCan.setState("cmi.total_time", "PTHM0S", stateCfg);
	startDuration = "PTHM0S";
};

/*============END DURATION FUNCTIONS==============*/


/*============SEND DATA TO LRS==============*/



function TCCSendLessonData(exiting)
{
	//This function is called whenever completion status changes

	//Send completed, passed, failed or attempted statement at end of attempt
	if (((value_store["cmi.completion_status"] == "completed")||(exiting=="true")) && (!(attemptCompleted)))
	{
		
		endAttempt();
	
	}

}


function endAttempt()
{
	var stmtToSend;		
	
	if (value_store["cmi.success_status"] == "passed")
	{
		
		stmtToSend = statementsCollection.passed;
	}
	else if (value_store["cmi.success_status"] == "failed")
	{
		
		stmtToSend = statementsCollection.failed;
	}
	else 
	{
		if (value_store["cmi.completion_status"] == "completed")
		{
			
			stmtToSend = statementsCollection.completed;
		}
		else
		{
			
			stmtToSend = statementsCollection.attempted;
		}
	}

	
	//Set the score, if present
	stmtToSend.result.score = new TinCan.Score;
	stmtToSend.result.score.scaled = value_store["cmi.score.scaled"];
	stmtToSend.result.score.raw = value_store["cmi.score.raw"];
	stmtToSend.result.score.min = value_store["cmi.score.min"];
	stmtToSend.result.score.max = value_store["cmi.score.max"];
	stmtToSend.result.score = deleteEmptyProperties(stmtToSend.result.score);
	
	
	//Set the Duration
	stmtToSend.result.duration = value_store["cmi.total_time"];
	
	//Send the statement, no callback
	myTinCan.sendStatement(stmtToSend, function() {});
		
	attemptCompleted = true; //Only send this success data once. 
	//reset the clock. Note: this means slides after the completed attempt but before learner restarts are counted towards next attempt
	resetClock();
}

function sessionStoppedStatement()
{
	var stmtToSend;
    var sessionDuration = value_store["cmi.session_time"];
    if (sessionDuration == "")
    {sessionDuration= "PTHM0S"}
   
    stmtToSend = statementsCollection.stopped;
    stmtToSend.result = new TinCan.Result
    stmtToSend.result.duration = sessionDuration;
    
	//Send the statement, no callback
	myTinCan.sendStatement(stmtToSend, function() {});
}


function TCCSendInteractionData(interactionIndex)
{
	
	//Captivate doesn't report a desciption
	//TODO: get these from somewhere clever e.g. some xml file
	var enInterationDescription = "Captivate Question"; 
	var questionName = "Captivate Question"; 
	
	//verb
	var interactionVerb = getVerb("answered", "http://adlnet.gov/expapi/verbs/");
	
	var correctResponsesPattern = new Array();
	var correctResponsesIndex = 0;
	
	while(1==1) //there's got to be a better way of coding this...
	{
		 var correctResponsesPatterntemp = value_store["cmi.interactions." + interactionIndex + ".correct_responses." + correctResponsesIndex + ".pattern"];
		 if (correctResponsesPatterntemp === undefined)
		 {break;}
		 else
		 {correctResponsesPattern[correctResponsesIndex] = correctResponsesPatterntemp}
		 correctResponsesIndex++;
	}
	//Create the activity definition
	var interactionDefinition = new TinCan.ActivityDefinition({
		type : "http://adlnet.gov/expapi/activities/cmi.interaction",
		name:  {
			"en-US" : questionName,
			"en-GB" : questionName 
		},
		description: {
			"en-US" : enInterationDescription,
			"en-GB" : enInterationDescription
		},
		"interactionType": value_store["cmi.interactions." + interactionIndex + ".type"],
		"correctResponsesPattern": correctResponsesPattern
		
	});
	//Create the activity
	var myInteraction = new TinCan.Activity({
		id : courseId + ':interactions#' + value_store["cmi.interactions." + interactionIndex + ".id"],
		definition : interactionDefinition
	});
	
	//Result
	var interactionResult = getResult(true);
	interactionResult.response = value_store["cmi.interactions." + interactionIndex + ".learner_response"];
	interactionResult.duration = value_store["cmi.interactions." + interactionIndex + ".latency"]
	//Score
	interactionResult.score = new TinCan.Score;
	interactionResult.score.min = 0;
	interactionResult.score.max = parseInt(value_store["cmi.interactions." + interactionIndex + ".weighting"]);
	switch (value_store["cmi.interactions." + interactionIndex + ".result"])
	{
		case "correct":
			interactionResult.success = true;
			interactionResult.score.scaled = 1;
			interactionResult.score.raw = interactionResult.score.max;
		break;
		case "incorrect":
			interactionResult.success = false;
			interactionResult.score.scaled = 0;
			interactionResult.score.raw = interactionResult.score.min;
		break;
		default:
		break;
	}
	
	
		//TODO: add timestamp in right format timestamp: convertSecondsToCMITimespan(value_store["cmi.interactions." + interactionIndex + ".timestamp"])
	//Statement
	var interactionStmt =  new TinCan.Statement({
		actor : myTinCan.actor,
		verb: interactionVerb,
		target : myInteraction,
		result: interactionResult
		
	},true);
	myTinCan.sendStatement(interactionStmt, function() {});
	
}

function compareWithCacheAndSetState(parameter,value,sendStateNow)
{
	var cached_value = cmiCache(parameter, value);
	
	if(!cached_value || cached_value !== value) {
		//Save to the value store
		value_store[parameter] = value;
		
		if (sendStateNow)
		{
			var stateJSON = JSON.stringify(value_store);
			myTinCan.setState('SCORMValues', stateJSON, stateCfg);
		}
		
		return true;
	}
	else
	{
		return false;
	}
}

function TCCSetParameter(parameter,value)
{ //TODO: WORK THROUGH THIS FUNCTION AND SEE WHAT IS REALLY NEDED. 

	//For SCORM 2004, Captivate sets a series of data every time it enters a new slide. 
	//It always sets the same data regardless of changes.
	//This template's javascript prevents unchanged data from reaching this function (using cmiCache).
	//Another SetValue call is "SetValue('cmi.exit', 'suspend')" made immediately after initialize.
	//for quizes, interaction data is also set.
	//All the paramters requested by captivate are represented in the switch statement below. 
	//In the event that a paramter has been missed, the broswer's console will display a message to let you know (at least in Chrome).
	
	//Send score, sucess and completion data all as one statement, only when they change. 
	//Deal with Location, suspend_data as another group as they change every slide. 
	//Send session_time whenever a statement is sent, but don't make a statement especially for it.  
	 
	switch (parameter)
	{
	case "cmi.exit": //(timeout, suspend, logout, normal, ��, WO) Indicates how or why the learner left the SCO
		//Captivate always sets this to suspend immediately after initializing. Its a SCORM thing, so we don't need to pass it on. 
		break;
	case "cmi.score.scaled": // score as a decimal
	case "cmi.score.min": // Minimum value in the range for the raw score. I think this is always 0 in captivate
	case "cmi.score.max": // Max possible score - this is set by the Captivate and doesn't change.
	case "cmi.score.raw": // Points score so far by the learner		
	case "cmi.success_status": // (�passed�, �failed�, �unknown�, RW) Indicates whether the learner has mastered the SCO
	//Just update the cache to pass later	
	//Add the value to the cache and update the state
	compareWithCacheAndSetState(parameter,value,false);

	break;
	case "cmi.session_time": //(timeinterval (second,10,2), WO) Amount of time that the learner has spent in the current learner session for this SCO 
		//e.g. "PT0H0M6S"
		
		//update session duration
		compareWithCacheAndSetState(parameter,value,false);
		
		//Update the attempt duration
		addDurations(startDuration,value);
	break;
	case "cmi.completion_status": // (�completed�, �incomplete�, �not attempted�, �unknown�, RW) Indicates whether the learner has completed the SCO
		
		//Only send the data if it has chnaged
		//Only send value to LMS if it hasn't already been sent;
		//If value is cached and matches what is about to be sent
		//to the LMS, prevent value from being sent a second time.
		if(compareWithCacheAndSetState(parameter,value,false)) {
		   completionChanged = true;
		} 					
	
		break;
	case "cmi.location": //0-index of the current slide - i.e. a bookmark.
	compareWithCacheAndSetState(parameter,value,false);
	break;
	case "cmi.suspend_data": //Captivate's Suspend Data string 
	//save the data
	compareWithCacheAndSetState(parameter,value,true);
	
	//Check if completion status chnaged in this batch of SCORM calls
	if (completionChanged)
	{
		completionChanged = false;
		TCCSendLessonData("false");

	}
	break;
	default:
	var paramterArray = new Array();
	var parameterStr = parameter.replace('..', '.0.');
	paramterArray = parameterStr.split('.')
		if (paramterArray[1] == "interactions")
		{ 
		
			//Handle interactions
			var interaction_index = paramterArray[2],
			interaction_parameter = paramterArray[3];
			
			switch(interaction_parameter)
			{
				case "id": //(long_identifier_type (SmallestPossibleMaximum: 4000), RW) Unique label for the interaction
				case "timestamp": //(time(second,10,0), RW) Point in time at which the interaction was first made available to the learner for learner interaction and response
				case "type": // (�true-false�, �choice�, �fill-in�, �long-fill-in�, �matching�, �performance�, �sequencing�, �likert�, �numeric� or �other�, RW) Which type of interaction is recorded
				case "weighting": //How many points the question is worth
				case "learner_response": //(format depends on interaction type, RW) Data generated when a learner responds to an interaction
				case "result": // (�correct�, �incorrect�, �unanticipated�, �neutral�) or a real number with values that is accurate to seven significant decimal figures real. , RW) Judgment of the correctness of the learner response
					compareWithCacheAndSetState(parameter,value,false);
					break;
				case "latency": //(timeinterval (second,10,2), RW) Time elapsed between the time the interaction was made available to the learner for response and the time of the first response
					//Note: I.e. Time taken to answer the question, not (as you might think) the lag the learner was experiencing at the time of the interaction (though this would include lag)! 
					//Consider reporting "since" and "until" using timestamp and latency data from the cmiCache
					
					compareWithCacheAndSetState(parameter,value,false);

					TCCSendInteractionData(interaction_index);
					
					break;
					
				//I have not yet witnessed captivate setting either "description" or "objectives", but they are included for completeness. 
				case "description": //(localized_string_type (SmallestPossibleMaximum: 250), RW) Brief informative description of the interaction
				case "objectives._count": //(non-negative integer, RO) Current number of objectives (i.e., objective identifiers) being stored by the LMS for this interaction
					compareWithCacheAndSetState(parameter,value,false);
					break;
				default:
				if (interaction_parameter == "correct_responses")
				{
					var interaction_correct_responses_index = parseInt(paramterArray[4]),
					interaction_correct_responses_parameter = paramterArray[5];
					switch(interaction_correct_responses_parameter)
					{
						case "pattern":  // (format depends on interaction type, RW) One correct response pattern for the interaction
							//Note: This needs further testing with all of captivate's question types to see if 'correct_responses.1' etc. need to be supported. 
							compareWithCacheAndSetState(parameter,value,false);
							break;
						default:
						myTinCan.log("Captivate attempt to set the unexpected interaction correct_responses parameter: '" + parameter +"' with value: '" + value +"'");
					}
				}
				else if (interaction_parameter == "objectives")
				{
					var interaction_objectives_index = paramterArray[4],
					interaction_objectives_parameter = paramterArray[5];
					switch(interaction_objectives_parameter)
					{
						case "id":  //(long_identifier_type (SPM: 4000), RW) Label for objectives associated with the interaction
							break;
						default:
						myTinCan.log("Captivate attempt to set the unexpected interaction objectives parameter: '" + parameter +"' with value: '" + value +"'");
					}
				}
				else
				{
					myTinCan.log("Captivate attempt to set the unexpected interaction parameter: '" + parameter +"' with value: '" + value +"'");
				}
			}
		}
		else
		{
			myTinCan.log("Captivate attempt to set the unexpected parameter: '" + parameter + "' with value: '" + value +"'");
		}
	}
	return "true";
}

/*============END SEND DATA TO LRS==============*/


/*============GET DATA FROM LRS==============*/
function TCCGetState()
{
	var rtnString = myTinCan.getState('SCORMValues', stateCfg).state.contents;
	
	if (typeof rtnString !== 'undefined')
	{
		var rtnArray = JSON.parse(rtnString);
		$.each(rtnArray, function(key, value){
			value_store[key] = value;
		});		
	}
}

function TCCGetFromCache(parameter)
{
	if (value_store[parameter])
	{
		return value_store[parameter];
	}
	else
	{
		return "";
	}
}


function TCCGetParameter(parameter)
{ 					
	//For SCORM 2004, Captivate gets a series of data from the LMS immediately after inititalizing. 
	//After that, no furter GetValue calls are made. 
	//All the paramters requested by captivate are represented in the switch statement below. 
	//In the event that a parameter has been missed, Chrome's console will display a message to let you know. 
	switch (parameter)
	{
	case "cmi.entry": // (ab_initio, resume, ��, RO) Asserts whether the learner has previously accessed the SCO
		var entryState = TCCGetFromCache("cmi.entry");
		//Next time the user loads this activty, cmi.entry tells captivate that they have accessed this before. 
		compareWithCacheAndSetState("cmi.entry","resume",false);		
		return entryState;
		break;
	case "cmi.location": //0-index of the current slide - i.e. a bookmark.
		return parseInt(TCCGetFromCache(parameter));
	break;
	case "cmi.suspend_data": //Captivate's Suspend Data string - must be returned exactly as it was set last attempt. Default is ''.
		return TCCGetFromCache(parameter);
		break;
	case "cmi.launch_data":  //(characterstring (SPM: 4000), RO) Data provided to a SCO after launch, initialized from the dataFromLMS manifest element
		//Captivate doesn't set dataFromLMS so this request will always return "" in SCORM
		return "";
		break;
	case "cmi.score._children"://(scaled,raw,min,max, RO) Listing of supported data model elements. 
		//SCORM cloud returns 'scaled,min,max,raw'. TCAPI explictly supports all 4 and Captivate uses all 4.  
		return 'scaled,min,max,raw';
		break;
	case "cmi.interactions._children": //(id,type,objectives,timestamp,correct_responses,weighting,learner_response,result,latency,description, RO) Listing of supported data model elements
		//SCORM cloud returns 'id,type,objectives,timestamp,correct_responses,weighting,learner_response,result,latency,description'
		//TCAPI's activity explictly supports: id, revision, platform, definition
		//definition contains: name, description, type, children, interaction_type, correct_responses
		//'interaction_type' in TCAPI is the same as 'type' in SCORM. 'type' in TCAPI is something new. 
		//TCAPI's result explictly supports: score, success, completion, response. 
		//this could map as: success -> result; response -> learner_response
		//Captivate actually sets: id, timestamp, type, correct_responses, weighting, learner_response, result, latency (this needs further testing to ensure list is exhuastive. ).
		//Note, id must be a URI. Perhaps the URL of the Activity Provider (this package) plus Captivate's interaction id?
		
		//The only two missing from my "Captivate uses these" list are objectives and description, which I'm guessing may come into play if you use the objectives settings in Captivate.
		//It may be just as well supporting everything to be safe.
		return 'id,type,objectives,timestamp,correct_responses,weighting,learner_response,result,latency,description';
		break;
	case "cmi.interactions._count": // (non-negative integer, RO) Current number of interactions being stored by the LMS
		//TODO: Calculate this somehow
		return 0;
		break;
	case "cmi.objectives._count": // (non-negative integer, RO) Current number of objectives being stored by the LMS
		//TODO: Calculate this somehow
		return 1;
		break;
	case "cmi.score.scaled": // score as a decimal
	case "cmi.score.min": //Minimum value in the range for the raw score. I think this is always 0 in captivate
	case "cmi.score.max": //Max possible score - this is set by the Captivate and doesn't change. 
	case "cmi.score.raw": //Points score so far by the learner
		return TCCGetFromCache(parameter);
		break;
	default:
		myTinCan.log("Captivate attempt to get the unexpected parameter: " + parameter);
	}
	
	//If we haven't yet returned anything:
	return TCCGetFromCache(parameter);
}
/*============END GET DATA FROM LRS==============*/


/*============HANDLE CAPTIVATE'S FUNCTION CALLS==============*/
// Handle fscommand messages from a Flash movie
function Captivate_DoFSCommand(command, args)
{//TODO: Test what happens if you delete this function entirely. 
	

	//Captivate 5.0 at least does call this function, but only to make invalid calls to the SCORM API to say that it has loaded or changed slide.
	//It therefore served no usful purpose in the first place, and certainly isn't needed for TinCan
	
	//The below code would be the result of the function after all the ifs and elses had been played out. 
	//I don't know what effect if any this has on the swf. 
	CaptivateObj.SetVariable("", "true"); //I'm 97% sure this line does nothing. 
	return "true"; //This one might be needed. 
}

function Captivate_DoExternalInterface(command, parameter, value, variable)
{
	varstrErr = "true";
	


myTinCan.log("Captivate_DoExternalInterface: command: "+command+" parameter: "+ parameter+" value: "+ value+" variable: "+ variable);

	//TODO: Check if we have a connection to the TCAPI, if not: return;

	//We don't want to do anything when Captivate calls Initialize, Terminate, Commit or GetLastError. We only need handle get and set with TinCan
	 if ( command == "LMSSetValue" || command=="SetValue") {
		strErr = TCCSetParameter(parameter,value);
		
	} else if ( command == "LMSGetValue" || command=="GetValue") {
		strErr = TCCGetParameter(parameter, variable);
	}
	else  if ( command == "LMSGetLastError" || command=="GetLastError")
	{
		strErr = 0;
	}
	else  if ( command == "LMSTerminate" || command=="Terminate")
	{
		endSession();
		
	}
	else
	{
		strErr = "true";

	}
	
	CaptivateObj.SetScormVariable(variable, strErr);
	return strErr;
}
/*============END HANDLE CAPTIVATE'S FUNCTION CALLS==============*/


/*============HANDLE CUSTOM CAPTIVATE FUNCTION CALLS==============*/
function CaptivateCompleted() 
{
	TCCSendLessonData("true");
	document.write("The Captivate Lesson has been completed. It is now safe to navigate away or close the popup window.");
}

function endSession() 
{	    
	sessionStoppedStatement();
	document.write("The Captivate Lesson has been completed. It is now safe to navigate away or close the popup window.");
}
/*============END HANDLE CUSTOM CAPTIVATE FUNCTION CALLS==============*/

/*============SWFOBJECT CODE==============*/
//Callback function for swfobject - Makes sure the Captivate has focus and gives us a handler
function callbackFn(e)
{
	//e.ref is the <object> aka SWF file. No need for getElementById
	if(e.success && e.ref){
		SWFRightClick.capture(e.ref);
		CaptivateObj = e.ref;
		CaptivateObj.tabIndex = -1; //Set tabIndex to enable focus on non-form elements
		CaptivateObj.focus();
	}
}
/*============END SWFOBJECT CODE==============*/



