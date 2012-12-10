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
		if((compareWithCacheAndSetState(parameter,value,false)) && (value == "completed")) {
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
		TCCSendLessonData();
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

/*============HANDLE CUSTOM CAPTIVATE FUNCTION CALLS==============*/
function CaptivateCompleted() 
{
	TCCSendLessonData();
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

