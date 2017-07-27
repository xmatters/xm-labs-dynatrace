// Get the Jira config info from the constants but default to something. 
var JIRA_PROJECT_KEY = constants['JIRA_PROJECT_KEY'] || "HELP";
var JIRA_ISSUE_TYPE  = constants['JIRA_ISSUE_TYPE' ] || "IT Help";
 
var dynatraceUtil = require('DynatraceUtil');
 
var callback = JSON.parse(request.body);
console.log("Executing outbound integration for xMatters event ID: " + callback.eventIdentifier);
 
// Convert list of event properties to an eventProperties object
if (callback.eventProperties && Array.isArray(callback.eventProperties)) {
    var eventProperties = callback.eventProperties;
    callback.eventProperties = {};
 
    for (var i = 0; i < eventProperties.length; i++) {
        var eventProperty = eventProperties[i];
        var key = Object.keys(eventProperty)[0];
        callback.eventProperties[key] = eventProperty[key];
    }
}
 
 
console.log('Processing response of ' + callback.response + ' from ' + callback.recipient);

switch (callback.response) {
    case 'Acknowledge':
        dtConfirmViaREST(callback);
        break;
    case 'Create Jira Ticket':
        createJiraTicket(callback.eventProperties,callback.recipient);
        break;
    default:
        break; 
}
 
 
function createJiraTicket(props,who) {
    console.log('RESPONSE IS CREATE JIRA TICKET');
   
    var summary = "DYNATRACE (SaaS) ALERT: " + props['ProblemTitle'];
 
    var description = "*DYNATRACE (SaaS) ALERT* \n";
    description += "*Title*:"  + props['ProblemTitle']                  + "\n";
    description += "*Impact*:" + props['ProblemImpact']                 + "\n";
    description += "*owner*:"  + who               + "\n";
 
 
    description += "*Details*:" + removeHTML(props['problem_details_0']) + ",  "
                                + removeHTML(props['problem_details_1']) + " \n"
                                +  removeHTML(props['problem_details_2']) + " \n"   
                                +  removeHTML(props['problem_details_3']) + " \n"   
                                +  removeHTML(props['problem_details_4']) + " \n"   
                                +  removeHTML(props['problem_details_5']) + " \n"   
                                +  removeHTML(props['problem_details_6']) + " \n"   
                                +  removeHTML(props['problem_details_7']) + " \n"   
                                + "\n";
 
    description += "*URL*:"                + props['ProblemURL'] + "\n";
    description += "*dynatraceProblemId*:" + props['PID']  + "\n";
    description += "*Tags:"                + props['Tags'] + "\n";
 
    var payload =  {
      "fields": {
        "project":
        {
           "key": JIRA_PROJECT_KEY
        },
        "summary": summary,
        "description": description,
        "issuetype": {
          "name": JIRA_ISSUE_TYPE
        },
        "priority": {
           "name": "Highest"
        }
      }
    };
 
    // Prepare the HTTP request
    var request = http.request({
        'endpoint': 'JIRA',
        'method': 'POST',
        'path': '/rest/api/2/issue/',
        'headers': {
            'Content-Type': 'application/json'
        }
    });
               
    // Submit the request and capture the response
    var response = request.write( payload );
    
    var body = JSON.parse(response.body);
    var key = body.key;
    
    // Write the response to the activity stream
    console.log(JSON.stringify(response));
    
    
    // PUT - this is to populate the Dynatrace entity property for dynatraceProblemId
 
                // Prepare the HTTP request
    var request = http.request({
        'endpoint': 'JIRA',
        'method': 'PUT',
        'path': '/rest/api/2/issue/'+key+'/properties/dynatraceProblemId',
        'headers': {
            'Content-Type': 'application/json'
        }
    });
               
    // Submit the request and capture the response
    var putResponse = request.write( JSON.stringify( { "dynatraceProblemId": props['PID'] } ) );
    
    // Write the response to the activity stream
    console.log(JSON.stringify(putResponse));
}
 
function dtConfirmViaREST(callback) {
   
  var dynatraceComment = "Incident alert: xMatters Event [" + callback.eventIdentifier + "]: "+ callback.recipient +
    " responded with " + callback.response + " on " + callback.device;
  var xMattersIntegrationName = "Incident alert webhook - Notification responses";
  dynatraceUtil.postComment(callback.eventProperties.PID, dynatraceComment, xMattersIntegrationName, callback.recipient, "xMatters");
 
}
 
function removeHTML (input) {
   
    if (!input)
        return "";
    var string = JSON.stringify(input);
    var output = string.replace(/<(?:.|\n)*?>/gm, '');
    return output;
 
}
