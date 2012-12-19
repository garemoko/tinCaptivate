
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
startDuration, //the attempt duration at the start of the session
offsetDuration; //used to account for session time that happeend prior to the current attempt.
/*============END OTHER GLOBAL VARIABLES==============*/
TinCan.DEBUG = true;
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
	
	//Send a started statement
	var stmtToSend; 
    stmtToSend = statementsCollection.started;
    stmtToSend.result = new TinCan.Result
    stmtToSend.result.duration = "PT0S";
    
	//Send the statement, no callback
	myTinCan.sendStatement(stmtToSend, function() {});
	

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
	var isValueNegative = (CMITimespan.indexOf('-') >= 0);
	var indexOfT = CMITimespan.indexOf("T");
    var indexOfH = CMITimespan.indexOf("H");
    var indexOfM = CMITimespan.indexOf("M");
    var indexOfS = CMITimespan.indexOf("S");
    
    var hours;
    var minutes;
    var seconds;
    
    if (indexOfH == -1) {
        indexOfH = indexOfT;
        hours = 0;
    }
    else {
        hours = parseInt(CMITimespan.slice(indexOfT + 1, indexOfH));    
    };
        
    if (indexOfM == -1) {
	    indexOfM = indexOfPT
	    minutes = 0;
    }
    else
    {
    	minutes = parseInt(CMITimespan.slice(indexOfH + 1, indexOfM));
    };
    
    seconds = parseInt(CMITimespan.slice(indexOfM + 1, indexOfS));
    
    var timespanInSeconds = parseInt((((hours * 60) + minutes) * 60) + seconds);
    if (isNaN(timespanInSeconds)){
    	timespanInSeconds=0
    };
    if (isValueNegative) {
    	timespanInSeconds = timespanInSeconds * -1;
    };
    
	return timespanInSeconds;
}

function convertSecondsToCMITimespan(inputSeconds)
{
	var hours, minutes, seconds, 
	i_inputSeconds = parseInt(inputSeconds);
	var inputIsNegative = "";
	if (i_inputSeconds < 0)
	{
		inputIsNegative = "-";
		i_inputSeconds = i_inputSeconds * -1;
	}
	
	hours = parseInt((i_inputSeconds) / 3600);
	minutes = parseInt(((i_inputSeconds) % 3600) / 60);
	seconds = parseInt(((i_inputSeconds) % 3600) % 60);
	
	var rtnStr = inputIsNegative + "PT";
	if (hours > 0)
	{
		rtnStr += hours +"H";
	}
	
	if (minutes > 0)
	{
		rtnStr += minutes +"M";
	}
	
	return rtnStr + seconds +"S";
}



function resetAttemptDuration() //reset the attempt duration timer to zero
{
	compareWithCacheAndSetState("cmi.total_time","PT0S",false)
	startDuration = "PT0S";
	offsetDuration
	if (value_store["cmi.session_time"] =='')
	{
		offsetDuration = "PT0S";
	}
	else
	{
		offsetDuration = "-" + value_store["cmi.session_time"];
	}
};

/*============END DURATION FUNCTIONS==============*/


function TCCSendLessonData()
{
	//This function is called whenever completion status changes

	//Send completed, passed, failed or attempted statement at end of attempt
	if (!(attemptCompleted))
	{
		endAttempt();
		attemptCompleted = true; //Only send this success data once. 
		
		//reset the clock. Note: this means slides after the completed attempt but before learner restarts are counted towards next attempt
		 resetAttemptDuration();
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
		
	
}

function sessionStoppedStatement()
{
	var stmtToSend;
    var sessionDuration = value_store["cmi.session_time"];
    if (sessionDuration == "")
    {sessionDuration= "PT0S"}
   
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
	
	while(typeof value_store["cmi.interactions." + interactionIndex + ".correct_responses." + correctResponsesIndex + ".pattern"] !== "undefined") 
	{
		 correctResponsesPattern[correctResponsesIndex] = value_store["cmi.interactions." + interactionIndex + ".correct_responses." + correctResponsesIndex + ".pattern"];
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
	
	//TODO: add context, particularly parent. 

	//Statement
	var interactionStmt =  new TinCan.Statement({
		actor : myTinCan.actor,
		verb: interactionVerb,
		target : myInteraction,
		result: interactionResult,
		timestamp: value_store["cmi.interactions." + interactionIndex + ".timestamp"] + '.000Z'
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

/*============END SEND DATA TO LRS==============*/


/*============GET DATA FROM LRS==============*/
function TCCGetState()
{
	var rtnState = myTinCan.getState('SCORMValues', stateCfg).state;
	
	
	if (rtnState)
	{
		var rtnString = rtnState.contents;
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

/*============END GET DATA FROM LRS==============*/





