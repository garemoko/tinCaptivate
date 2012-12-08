/*
=============COPYRIGHT============ 
Tin Statement Sender - An I-Did-This prototype for Tin Can API 0.95
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






/*============DOCUMENT READY==============*/
$(function(){
	
	
	//Set Up LRS
	//Add one blank LRS to the page by default
	appendLRS();
	//When the user clicks '+LRS', append an extra LRS
	$('#lrsLrsAdd').click(appendLRS);
	$('#lrsLrsRemove').click({elementId: 'lrs', propertyClass: 'lrs', minimum:1},removeProperty);
	getLRSFromQueryString();
	
	
	//Set up Actor
	appendAgent('actorAgent');
	
	//send statement
	$('#sendStatement').click(launchCaptivate);
});
/*============END DOCUMENT READY==============*/


/*============SEND STATEMENT==============*/
function launchCaptivate()
{
	//lrs=[{"endpoint":"https://YourSiteAddress.waxlrs.com/TCAPI/","login":"YourBasicLogin","pass":"YourBasicPassword"},{"endpoint":"https://cloud.scorm.com/ScormEngineInterface/TCAPI/YourApplicationID/","login":"YourApplicationID","pass":"CorrespondingSecretKey"},{"endpoint":"https://cloud.scorm.com/ScormEngineInterface/TCAPI/public/","login":"","pass":""},{"endpoint":"https://watershed.ws/tc","login":"","pass":""}]
	var launchLink = 'tin-can-can.htm?lrs=[';

	
	//LRS
	var LRSArray = $('#lrs').find('.lrs');
	LRSArray.each(function(index){
		launchLink += '{'; 
		launchLink += '"endpoint":"' + $(this).find('.endpoint').val() +'",'; 
		launchLink += '"login":"' + $(this).find('.basicLogin').val() +'",'; 
		launchLink += '"pass":"' + $(this).find('.basicPass').val() +'"'; 
		launchLink += '}';
		if (index < (LRSArray.length - 1))
		{
			launchLink += ',';
		}
		
	});
	
	launchLink += ']&actor={';
	
	//Actor
	launchLink += '"name":"' + $('#actor').find('.agent:first').find('.name').val() +'",'; 
	
	if ($('#actor').find('.functionalIdentifierType') == 'account')
	{
		launchLink += '"acccount": {';
		launchLink += '"name":"' + $('#actor').find('.agent:first').find('.accountName').val() +'",'; 
		launchLink += '"homePage":"' + $('#actor').find('.agent:first').find('.accountHomePage').val() +'",'; 
		launchLink += '}';
	}
	else
	{
		launchLink +='"' + $('#actor').find('.agent:first').find('.functionalIdentifierType').val() +'":"' + $('#actor').find('.agent:first').find('.functionalIdentifier').val() + '"';
	}
						
	launchLink += '}';
	
	window.open(launchLink);
}

