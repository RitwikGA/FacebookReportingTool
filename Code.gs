/* Facebook Reporting & Cost Data Upload in Google Analytics 
 * Description: Exports Facebook Ads Data in Google Sheets & Uploads it To Google Analytics.
 * @Ritwikga www.Digishuffle.com
 *
 * Updated: 21-05-2019
 * - Breakdown Feature
 * - Data Import Alerts
 * - UI Improvements & Bug Fixes
 *
 * Recent Updates @https://github.com/RitwikGA/FacebookReportingTool/
 */

///// Facebook Details ///////

var CLIENT_ID = '';     // Insert App ID                                        

var CLIENT_SECRET = '';   // Insert App Secret

var FB_AD_ACCOUNT_ID = '';   //Ad Account Id

// More fields at https://developers.facebook.com/docs/marketing-api/insights/parameters 
var FB_FIELDS = 'campaign_name,clicks,spend,impressions,date_start'; 

// More brekadowns at https://developers.facebook.com/docs/marketing-api/insights/breakdowns 
var FB_BREAKDOWN = '';     

var FB_LEVEL = 'campaign'; // ad,adset,campaign,account 

var pos = [1,1]     //Spreadsheet Cell Position

// More DATE_RANGE at https://developers.facebook.com/docs/marketing-api/insights/parameters (date_preset paramteter)
var DATE_RANGE='last_7d';    //today, yesterday, this_month, last_month, this_quarter, etc 

// To use below date range, make sure DATE_RANGE='' // 
var start_date='2019-01-01';                // custom date range
var end_date='2019-01-30';
var splitByDate = false;

var limit = 100;      //Facebook Graph API Limit per request


// Facebook Ad URL UTMs values (Only for GA Upload Format) //
var isGaUpload = false                    // set to True, to export GA upload compatible data
var SOURCE = "facebook"                   // source, if not specified in Facebook Tracking URL Params utm_source
var MEDIUM = "cpc"                        // medium, if not specified in Facebook Tracking URL Params utm_medium

// Google Analytics Data (Only for GA Upload Format) //
var ACCOUNT_ID = "";                      //Account ID
var PROPERTY_ID = "";                //Property ID
var DATASET_ID = "";        //Data set upload ID
 
// CurrenyMultiplier (Only for GA Upload Format) //
var currenyMultiplier = 1;       //Will Multipy 'Spend' Field. (Currency converter only for GA upload)


//// Emailers (Only for GA Upload Format)////////////  
var isEmail = false                     // Will Send Email To Provide Status Of Upload (During Automation)
var subject = ''                        // Enter Subject Line For Email Else It Fallback To "Facebook Data Upload To GA(ACCOUNTID)"


/**
*
*  Input Variable Values Ends
*
*/


////// ACCOUNTDATA Literal ////////////////////
var ACCOUNTDATA = {
adAccountUIFields : ['account_currency','account_id','account_name','ad_name','adset_name','campaign_name','clicks','impressions','cpc',
'cpm','date_start','date_stop','reach','spend','unique_clicks'],
   /// The Columns To Be Populated in the Fields Box in the UI.
adAccountLevels : ['ad','adset','campaign','account'], /// The Columns To Be Populated in the Fields Box in the UI.
adAccountBreakdowns : ['age','country','gender','impression_device','product_id','region','dma','frequency_value','hourly_stats_aggregated_by_advertiser_time_zone',
                       'hourly_stats_aggregated_by_audience_time_zone','publisher_platform','platform_position','device_platform'],  
getUIFields : function(y) {return y.map(function(i){return {id:i,text:i.split('_').map(function(j){return j.charAt(0).toUpperCase()+j.slice(1)}).join(' ')}})},
getUIHeaders : function(k){return k.map(function(i){return i.split('_').map(function(j){return j.charAt(0).toUpperCase()+j.slice(1)}).join(' ')})},
facebookData : {facebookAccountId:FB_AD_ACCOUNT_ID,
                facebookLevel:FB_LEVEL,
                facebookFields:FB_FIELDS,
                facebookBreakdowns:FB_BREAKDOWN},

dateData : {
  preDefinedRage: DATE_RANGE,
  startDate : start_date,
  endDate: end_date,
    splitByDate:splitByDate
},                

additionalData: {
isGaUpload:isGaUpload,
source:SOURCE,
medium:MEDIUM,
pos:pos,
limit:limit
}
}

function showBar() {
var html=HtmlService.createTemplateFromFile('digiSideBar').evaluate().setTitle("Facebook Reporting Tool").setWidth(300)
SpreadsheetApp.getUi().showSidebar(html)
}

function facebookData()
{ makeRequest(ACCOUNTDATA) }
  
function uploadDataToGa()
{  uploadData(ACCOUNT_ID, PROPERTY_ID, DATASET_ID) }

function onOpen() {
SpreadsheetApp.getUi().createMenu('Reports').addSubMenu(SpreadsheetApp.getUi()
 .createMenu('Facebook').addItem("Open Sidebar", 'showBar').addSeparator().addItem("Authorize", 'fbAuth').addItem("Log Out", 'reset').addItem("Export Data", 'facebookData').addItem("Upload Data To GA", 'uploadDataToGa'))
.addSeparator().addItem("oAuth Redirect URI", 'getValidOauthRedirectUrl').addToUi();

}

function fbAuth(){
  var UI=HtmlService.createTemplate("<b><a href='<?=getService().getAuthorizationUrl()?>' target='_blank'>Click To Authorize</a></b><br /><? if(getService().hasAccess())"+ 
                                    "{ ?> <?!= <p><span style='color:green'>Authorized Successfully</span></p> } else {?> <?!= <p><span style='color:red'>Not Authorized</span></p> }").evaluate() 
  SpreadsheetApp.getUi().showModalDialog(UI, "Facebook Authorization")
 
}


function jsonToQuery(param)
{
var str = "";
for (var key in param) {
    if (str != "") {
        str += "&";
    }
    str += key + "=" + param[key];
}
return str
}

function getValidOauthRedirectUrl(){

var validOauthUrl = Utilities.formatString('https://developers.facebook.com/apps/%s/fb-login/settings/', CLIENT_ID)
var htmlOutput = HtmlService
.createHtmlOutput('<style>span{font-size: 14px;font-weight: bold;text-decoration: underline;font-style: italic;cursor: pointer;}</style>'+
                  '<script>function selectURL(){document.getElementById("oauthURL").select();document.execCommand("copy")}</script>'+
                  '<p>Copy & Paste The Below URL In <a href="'+validOauthUrl+'"><i>Valid OAuth Redirect URIs</i></a></p>'+
                  '<br /><span onclick="selectURL()">Copy to Clipboard</span><textarea type="text" id="oauthURL" style="width:100%;">'+Utilities.formatString("https://script.google.com/macros/d/%s/usercallback", ScriptApp.getScriptId())+
                  '</textarea>')
    .setWidth(450)
    .setHeight(200);
SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Valid OAuth Redirect URIs')
}


function makeRequest(ACCOUNTDATAOBJECT) {

if(!ACCOUNTDATAOBJECT['callFrom']) {ACCOUNTDATAOBJECT = ACCOUNTDATA}  

 var fbRequest = getService(); 
 var requestEndpoint = "https://graph.facebook.com/v3.3/act_"+ACCOUNTDATAOBJECT['facebookData']['facebookAccountId']+"/insights?"
 var param = {'limit':ACCOUNTDATAOBJECT['additionalData']['limit'],'level': ACCOUNTDATAOBJECT['facebookData']['facebookLevel']}
 
 if(ACCOUNTDATAOBJECT['additionalData']['isGaUpload']) {
 param['fields'] = 'ad_id,'+ACCOUNTDATAOBJECT['facebookData']['facebookFields']
 param['time_increment'] = '1'
 } else {
 param['fields'] = ACCOUNTDATAOBJECT['facebookData']['facebookFields']
 }

if(param['fields'] == ''){SpreadsheetApp.getUi().alert("Enter The Fields");return}
  
if(ACCOUNTDATAOBJECT['facebookData']['facebookBreakdowns'] != ''){param['breakdowns'] = ACCOUNTDATAOBJECT['facebookData']['facebookBreakdowns'] }  
if(ACCOUNTDATAOBJECT['dateData']['splitByDate']){param['time_increment'] = '1'}  

if(ACCOUNTDATAOBJECT['dateData']['preDefinedRage']!="")
{ param['date_preset'] = ACCOUNTDATAOBJECT['dateData']['preDefinedRage'] ;}
else if(ACCOUNTDATAOBJECT['dateData']['startDate']!=""&&ACCOUNTDATAOBJECT['dateData']['endDate']!="") 
{ param['time_range[since]']=ACCOUNTDATAOBJECT['dateData']['startDate'];param['time_range[until]']=ACCOUNTDATAOBJECT['dateData']['endDate'];}
else {  SpreadsheetApp.getUi().alert("Enter Correct Date Range!!");return}
 

var response = UrlFetchApp.fetch(requestEndpoint + jsonToQuery(param), 
{headers: {'Authorization': 'Bearer ' + fbRequest.getAccessToken()},muteHttpExceptions : true})


var parseData = JSON.parse(response)
if(parseData.hasOwnProperty('error'))
{
if(parseData.error.hasOwnProperty('error_user_title'))
{SpreadsheetApp.getUi().alert(parseData.error.error_user_title)}
else{SpreadsheetApp.getUi().alert(parseData.error.message)}
return
}

//if(parseData.data.length == 0)
//{SpreadsheetApp.getUi().alert('No Facebook Data For The Applied Date Range'); return;}  
  
  
if(ACCOUNTDATAOBJECT['additionalData']['isGaUpload'] && parseData.data.length > 0){
var utms_endpoint = "https://graph.facebook.com/v3.3/act_"+ACCOUNTDATAOBJECT['facebookData']['facebookAccountId']+"/ads?fields=adcreatives%7Burl_tags%7D&limit="+5000
var utms_ads = UrlFetchApp.fetch(utms_endpoint, 
{headers: {'Authorization': 'Bearer ' + fbRequest.getAccessToken()},muteHttpExceptions : true}) 

var parsed_utms = JSON.parse(utms_ads)
if(parsed_utms.hasOwnProperty('error'))
{
if(parsed_utms.error.hasOwnProperty('error_user_title'))
{SpreadsheetApp.getUi().alert(parsed_utms.error.error_user_title)}
else{SpreadsheetApp.getUi().alert(parsed_utms.error.message)}
return
}
var parsed_utms_data = nextTokenData(parsed_utms)
}

 

try{
parseData = nextTokenData(parseData)
var fieldArray = param['fields'].split(",")
if(param['breakdowns']){fieldArray = fieldArray.concat(param['breakdowns'].split(","))}

var headers = ACCOUNTDATA.getUIHeaders(fieldArray)
var sheet= SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];  


var pos = ACCOUNTDATAOBJECT['additionalData']['pos']  
if(typeof(ACCOUNTDATAOBJECT['additionalData']['pos']) == 'string'){
pos = ACCOUNTDATAOBJECT['additionalData']['pos'].split(",")   
}  

if(sheet.getLastRow() > 0 && sheet.getLastColumn() > 0)
{sheet.getRange(pos[0],pos[1],sheet.getLastRow(),sheet.getLastColumn()).clear()}

var finalParsedOutput = []    

if(ACCOUNTDATAOBJECT['additionalData']['isGaUpload']){ 
if(parseData.data.length > 0 ){finalParsedOutput=parser(parseData,parsed_utms_data,ACCOUNTDATAOBJECT['additionalData']['source'],ACCOUNTDATAOBJECT['additionalData']['medium'])}
  else {finalParsedOutput.push([])}  
}
else{
finalParsedOutput = parserNonGA(parseData, fieldArray);
finalParsedOutput.unshift(headers);
  
var cell = sheet.getRange(pos[0],pos[1],1,finalParsedOutput[0].length)  
cell.setFontWeight("bold")
cell.setBorder(false, false, true, false, false, false,"black",SpreadsheetApp.BorderStyle.DOUBLE)
}
  
if(finalParsedOutput[0].length > 0) {sheet.getRange(pos[0], pos[1], finalParsedOutput.length, finalParsedOutput[0].length).setValues(finalParsedOutput)}

var statusDescription = "DATE: "+ACCOUNTDATAOBJECT['dateData']['startDate']+" TO "+ACCOUNTDATAOBJECT['dateData']['endDate']+"<br /> ACCOUNT_ID: "+ACCOUNTDATAOBJECT['facebookData']['facebookAccountId']+"<br /> ROWS: "+finalParsedOutput.length;
return {status:'success', description:statusDescription}
} catch (e) {Logger.log(e) }
  

};
 

function nextTokenData(parseData)
{
if(parseData.data.length == 0) {return parseData}    
var fbRequest = getService();
if(parseData.paging.next != undefined)
{ 
var parsedata_pg = parseData;
while (true)
{
var response = UrlFetchApp.fetch(parsedata_pg.paging.next, 
  {headers: {'Authorization': 'Bearer ' + fbRequest.getAccessToken()},muteHttpExceptions : true})
parsedata_pg = JSON.parse(response)
parseData.data = parseData.data.concat(parsedata_pg.data)
if(parsedata_pg.paging.next == undefined) 
{ break;}
}}
return parseData
}

function AdIds(id, parsed_utms_data)
{
var data = parsed_utms_data
for (i in data.data)  
{
if (data.data[i].id == id)
{ 
if (data.data[i].adcreatives.data[0].url_tags != undefined)
{
var tags = data.data[i].adcreatives.data[0].url_tags   
var ids_obj = {}  

ids_obj['id']=data.data[i].id 

if (/utm_source=([^&]+)/i.exec(tags) != null)
{ids_obj['source'] = /utm_source=([^&]+)/i.exec(tags)[1]}

if (/utm_medium=([^&]+)/i.exec(tags) != null)
{ids_obj['medium'] = /utm_medium=([^&]+)/i.exec(tags)[1]}

if (/utm_campaign=([^&]+)/i.exec(tags) != null)
{ids_obj['campaign'] = /utm_campaign=([^&]+)/i.exec(tags)[1]}

if (/utm_content=([^&]+)/i.exec(tags) != null)
{ids_obj['content'] = /utm_content=([^&]+)/i.exec(tags)[1]}
  
} else { return false }
return ids_obj
} } }

function parserNonGA(parseData, fieldsArray){
var data=parseData.data;  
var rw=[];
for (var i = 0; i < data.length; i++)
{
rw[i]= Array.apply(null, new Array(fieldsArray.length)).map(Number.prototype.valueOf,0);
for (key in data[i]) {rw[i][fieldsArray.indexOf(key)] = data[i][key].replace(/\,|\'|\"/g,'')}
}
return rw
}

function parser(parseData,parsed_utms_data,SOURCE,MEDIUM)
{
var Data=parseData;  
var rw=[];
 for (var i = 0; i < Data.data.length; i++)
 {
 rw[i]=[]
 var p = {}
 for (key in Data.data[i])
 {
   if (key == 'ad_id') { p = AdIds(Data.data[i][key],parsed_utms_data); continue;} 
   
   if (p==undefined) { Logger.log("Ad ID Error"); break; }
   if (key == 'campaign_name') 
     { if (p.campaign != undefined) 
     {rw[i].push(p.campaign);continue;} 
     else { rw[i].push(Data.data[i][key].replace(/\,|\'|\"/g,'')); continue; }
    }
   if (key == 'ad_name') 
     { 
     if (p.content != undefined) 
     {
     rw[i].push(p.content); continue;
     } else { rw[i].push(Data.data[i][key].replace(/\,|\'|\"/g,'')); continue; }
    }
    
   if(key == 'spend') { rw[i].push(Data.data[i][key]*currenyMultiplier); continue; }
   
   if(key=='date_stop') {continue;}
   if(key=='date_start') {rw[i].push(Data.data[i][key].toString().split('-').join(''));continue;}
    
   rw[i].push(Data.data[i][key].replace(/\,|\'|\"/g,''))
 }
  if (p.source !=undefined)
  { rw[i].push( p.source )  }
   else{ rw[i].push(SOURCE)}
   
   if (p.medium !=undefined)
   {rw[i].push( p.medium ) }
     else{rw[i].push(MEDIUM)}
 } 
  return rw
}


/**
*  oAuth Script : https://github.com/googlesamples/apps-script-oauth2
*/

/**
 * Configures the service.
 */
function getService() {
  return OAuth2.createService('Facebook')
      // Set the endpoint URLs.
      .setAuthorizationBaseUrl('https://www.facebook.com/dialog/oauth')
      .setTokenUrl('https://graph.facebook.com/v3.3/oauth/access_token')

      // Set the client ID and secret.
      .setClientId(CLIENT_ID)
      .setClientSecret(CLIENT_SECRET)

      // Set the name of the callback function that should be invoked to complete
      // the OAuth flow.
      .setCallbackFunction('authCallback')
  
  
      //Set Scope
      .setScope('ads_read') 
  

      // Set the property store where authorized tokens should be persisted.
      .setPropertyStore(PropertiesService.getUserProperties());
}


function authCallback(request) {
  var isAuthorized = getService().handleCallback(request);
 
  if (isAuthorized) {
    successUI(true)
    showBar()
    return HtmlService.createHtmlOutput('Success! You can close this tab.<script>window.top.close()</script>');
  } else {
    successUI(false)
    showBar()
    return HtmlService.createHtmlOutput('Denied. You can close this tab.<script>window.top.close()</script>');
  }
}


function reset() {
  var service = getService();
  service.reset();
  showBar()
  SpreadsheetApp.getUi().alert("Log Out Success!!")
}

function successUI(isAuth){

 if(isAuth){
  var UI=HtmlService.createHtmlOutput("<b><span style='color:green'>Authorization Successful</span></b>")
  SpreadsheetApp.getUi().showModalDialog(UI, "Authorization Status") } else
  {var UI=HtmlService.createHtmlOutput("<b><span style='color:red'>Authorization Fail</span></b>")
    SpreadsheetApp.getUi().showModalDialog(UI, "Authorization Status")}
}


function adAccounts(){

 var fbRequest = getService(); 
  var addaccounts_endpoint = "https://graph.facebook.com/v3.3/me?fields=adaccounts.limit(100)%7Bname,account_id%7D" 
 
  var adAccountInfo = UrlFetchApp.fetch(addaccounts_endpoint, 
  {headers: {'Authorization': 'Bearer ' + fbRequest.getAccessToken()},muteHttpExceptions : true}) 
  
  var parsedadAccountInfo = JSON.parse(adAccountInfo)
  if(parsedadAccountInfo.hasOwnProperty('error') || !parsedadAccountInfo.adaccounts)
  {SpreadsheetApp.getUi().alert('ERROR: '+parsedadAccountInfo['error']['message']);return false} 
  else {
  var adAccountFB = nextTokenData(parsedadAccountInfo.adaccounts,200)
  var parsed_adurls = parsedadAccountInfo;
  parsed_adurls['adaccounts'] = adAccountFB
}

  return { 'facebookAccountData':parsed_adurls.adaccounts.data } 
}


////
//
//Cost Data Upload Script - http://www.ryanpraski.com/google-analytics-cost-data-import-google-sheets-automated/ 
//
////


function uploadData(ACCOUNT_ID, PROPERTY_ID, DATASET_ID) {
  var accountId = ACCOUNT_ID 
  var webPropertyId = PROPERTY_ID 
  var customDataSourceId = DATASET_ID 
  var ss = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var maxRows = ss.getLastRow();
  var maxColumns = ss.getLastColumn();
  var data = [];
  for (var i = 1; i <= maxRows;i++) {
    data.push(ss.getRange([i], 1,1, maxColumns).getValues());
  }
  var newData = data.join("\n");
  var blobData = Utilities.newBlob(newData, "application/octet-stream", "GA import data");
  
  uploadStatus(accountId, webPropertyId, customDataSourceId, blobData)
}

function uploadStatus(accountId, webPropertyId, customDataSourceId, blobData){

   try {
    var upload = Analytics.Management.Uploads.uploadData(accountId, webPropertyId, customDataSourceId, blobData);   
    SpreadsheetApp.getUi().alert("Data Has Been Sent To Google Analytics.!! Checking Errors...");
    var uploadId = JSON.parse(upload)
    var count = 0   
    while(count < 5)
    {var status =Analytics.Management.Uploads.get(accountId, webPropertyId , customDataSourceId, uploadId.id )
    status = JSON.parse(status)
    if(status['status'] == 'PENDING')
    {count++;Utilities.sleep(1000)}
    else if(status['status'] == 'COMPLETED'){  
    SpreadsheetApp.getUi().alert("SUCCESS.!! No Errors Found. Data Has Been Successfully Uploaded");
    sendEmail(isEmail,subject,"SUCCESS")  
    break;
    } else if(status['status'] == 'FAILED')
    {
    var error = ""
    for(var j=0;j<status.errors.length;j++)
    {error += (j+1)+".) "+status.errors[j]+" \n" }  
    SpreadsheetApp.getUi().alert("FAILED.!! Here are some errors. \n"+error );
    sendEmail(isEmail,subject,error)        
    break;
    }}}
  catch(err) {
    return 
  }
}

function sendEmail(isEmail,subject,status){
if(!isEmail){return;}  
if(MailApp.getRemainingDailyQuota() == 0) {return;}
  
  var subject = ''
  var subject = subject == '' ? 'Facebook Data Upload To GA ('+ACCOUNT_ID+')' : subject
  var message = '';  
  if(status == "SUCCESS" ){
  message = "<h3>Data Has Been Successfully Uploaded in Google Analytics.</h3><br /><p>- AccountID: "+ACCOUNT_ID+"<br />"+
    "<p>- Property ID: "+PROPERTY_ID}
  else{ message = "<h3>Data Import Has Been Failed. Here are some errors</h3><br /><p> Errors: "+status+"<br />"  
      }
  MailApp.sendEmail({
    'to':Session.getActiveUser().getEmail(),
    'subject':subject,
    'htmlBody':message
  })

}



//////////////////////////////////////////////
(function (host, expose) {
   var module = { exports: {} };
   var exports = module.exports;
   /****** code begin *********/
// Copyright 2014 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Contains the methods exposed by the library, and performs
 * any required setup.
 */

/**
 * The supported formats for the returned OAuth2 token.
 * @enum {string}
 */
var TOKEN_FORMAT = {
  /** JSON format, for example <code>{"access_token": "..."}</code> **/
  JSON: 'application/json',
  /** Form URL-encoded, for example <code>access_token=...</code> **/
  FORM_URL_ENCODED: 'application/x-www-form-urlencoded'
};

/**
 * The supported locations for passing the state parameter.
 * @enum {string}
 */
var STATE_PARAMETER_LOCATION = {
  /**
   * Pass the state parameter in the authorization URL.
   * @default
   */
  AUTHORIZATION_URL: 'authorization-url',
  /**
   * Pass the state token in the redirect URL, as a workaround for APIs that
   * don't support the state parameter.
   */
  REDIRECT_URL: 'redirect-url'
};

/**
 * Creates a new OAuth2 service with the name specified. It's usually best to
 * create and configure your service once at the start of your script, and then
 * reference them during the different phases of the authorization flow.
 * @param {string} serviceName The name of the service.
 * @return {Service_} The service object.
 */
function createService(serviceName) {
  return new Service_(serviceName);
}

/**
 * Returns the redirect URI that will be used for a given script. Often this URI
 * needs to be entered into a configuration screen of your OAuth provider.
 * @param {string} scriptId The script ID of your script, which can be found in
 *     the Script Editor UI under "File > Project properties".
 * @return {string} The redirect URI.
 */
function getRedirectUri(scriptId) {
  return Utilities.formatString(
    'https://script.google.com/macros/d/%s/usercallback', scriptId);
}

if (typeof module === 'object') {
  module.exports = {
    createService: createService,
    getRedirectUri: getRedirectUri,
    TOKEN_FORMAT: TOKEN_FORMAT,
    STATE_PARAMETER_LOCATION: STATE_PARAMETER_LOCATION
  };
}

// Copyright 2014 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Contains the Service_ class.
 */

// Disable JSHint warnings for the use of eval(), since it's required to prevent
// scope issues in Apps Script.
// jshint evil:true

/**
 * Creates a new OAuth2 service.
 * @param {string} serviceName The name of the service.
 * @constructor
 */
var Service_ = function(serviceName) {
  validate_({
    'Service name': serviceName
  });
  this.serviceName_ = serviceName;
  this.params_ = {};
  this.tokenFormat_ = TOKEN_FORMAT.JSON;
  this.tokenHeaders_ = null;
  this.scriptId_ = eval('Script' + 'App').getScriptId();
  this.expirationMinutes_ = 60;
};

/**
 * The number of seconds before a token actually expires to consider it expired
 * and refresh it.
 * @type {number}
 * @private
 */
Service_.EXPIRATION_BUFFER_SECONDS_ = 60;

/**
 * The number of milliseconds that a token should remain in the cache.
 * @type {number}
 * @private
 */
Service_.LOCK_EXPIRATION_MILLISECONDS_ = 30 * 1000;

/**
 * Sets the service's authorization base URL (required). For Google services
 * this URL should be
 * https://accounts.google.com/o/oauth2/auth.
 * @param {string} authorizationBaseUrl The authorization endpoint base URL.
 * @return {Service_} This service, for chaining.
 */
Service_.prototype.setAuthorizationBaseUrl = function(authorizationBaseUrl) {
  this.authorizationBaseUrl_ = authorizationBaseUrl;
  return this;
};

/**
 * Sets the service's token URL (required). For Google services this URL should
 * be https://accounts.google.com/o/oauth2/token.
 * @param {string} tokenUrl The token endpoint URL.
 * @return {Service_} This service, for chaining.
 */
Service_.prototype.setTokenUrl = function(tokenUrl) {
  this.tokenUrl_ = tokenUrl;
  return this;
};

/**
 * Sets the service's refresh URL. Some OAuth providers require a different URL
 * to be used when generating access tokens from a refresh token.
 * @param {string} refreshUrl The refresh endpoint URL.
 * @return {Service_} This service, for chaining.
 */
Service_.prototype.setRefreshUrl = function(refreshUrl) {
  this.refreshUrl_ = refreshUrl;
  return this;
};

/**
 * Sets the format of the returned token. Default: OAuth2.TOKEN_FORMAT.JSON.
 * @param {OAuth2.TOKEN_FORMAT} tokenFormat The format of the returned token.
 * @return {Service_} This service, for chaining.
 */
Service_.prototype.setTokenFormat = function(tokenFormat) {
  this.tokenFormat_ = tokenFormat;
  return this;
};

/**
 * Sets the additional HTTP headers that should be sent when retrieving or
 * refreshing the access token.
 * @param {Object.<string,string>} tokenHeaders A map of header names to values.
 * @return {Service_} This service, for chaining.
 */
Service_.prototype.setTokenHeaders = function(tokenHeaders) {
  this.tokenHeaders_ = tokenHeaders;
  return this;
};

/**
 * @callback tokenHandler
 * @param tokenPayload {Object} A hash of parameters to be sent to the token
 *     URL.
 * @param tokenPayload.code {string} The authorization code.
 * @param tokenPayload.client_id {string} The client ID.
 * @param tokenPayload.client_secret {string} The client secret.
 * @param tokenPayload.redirect_uri {string} The redirect URI.
 * @param tokenPayload.grant_type {string} The type of grant requested.
 * @returns {Object} A modified hash of parameters to be sent to the token URL.
 */

/**
 * Sets an additional function to invoke on the payload of the access token
 * request.
 * @param {tokenHandler} tokenHandler tokenHandler A function to invoke on the
 *     payload of the request for an access token.
 * @return {Service_} This service, for chaining.
 */
Service_.prototype.setTokenPayloadHandler = function(tokenHandler) {
  this.tokenPayloadHandler_ = tokenHandler;
  return this;
};

/**
 * Sets the name of the authorization callback function (required). This is the
 * function that will be called when the user completes the authorization flow
 * on the service provider's website. The callback accepts a request parameter,
 * which should be passed to this service's <code>handleCallback()</code> method
 * to complete the process.
 * @param {string} callbackFunctionName The name of the callback function.
 * @return {Service_} This service, for chaining.
 */
Service_.prototype.setCallbackFunction = function(callbackFunctionName) {
  this.callbackFunctionName_ = callbackFunctionName;
  return this;
};

/**
 * Sets the client ID to use for the OAuth flow (required). You can create
 * client IDs in the "Credentials" section of a Google Developers Console
 * project. Although you can use any project with this library, it may be
 * convinient to use the project that was created for your script. These
 * projects are not visible if you visit the console directly, but you can
 * access it by click on the menu item "Resources > Advanced Google services" in
 * the Script Editor, and then click on the link "Google Developers Console" in
 * the resulting dialog.
 * @param {string} clientId The client ID to use for the OAuth flow.
 * @return {Service_} This service, for chaining.
 */
Service_.prototype.setClientId = function(clientId) {
  this.clientId_ = clientId;
  return this;
};

/**
 * Sets the client secret to use for the OAuth flow (required). See the
 * documentation for <code>setClientId()</code> for more information on how to
 * create client IDs and secrets.
 * @param {string} clientSecret The client secret to use for the OAuth flow.
 * @return {Service_} This service, for chaining.
 */
Service_.prototype.setClientSecret = function(clientSecret) {
  this.clientSecret_ = clientSecret;
  return this;
};

/**
 * Sets the property store to use when persisting credentials (required). In
 * most cases this should be user properties, but document or script properties
 * may be appropriate if you want to share access across users.
 * @param {PropertiesService.Properties} propertyStore The property store to use
 *     when persisting credentials.
 * @return {Service_} This service, for chaining.
 * @see https://developers.google.com/apps-script/reference/properties/
 */
Service_.prototype.setPropertyStore = function(propertyStore) {
  this.propertyStore_ = propertyStore;
  return this;
};

/**
 * Sets the cache to use when persisting credentials (optional). Using a cache
 * will reduce the need to read from the property store and may increase
 * performance. In most cases this should be a private cache, but a public cache
 * may be appropriate if you want to share access across users.
 * @param {CacheService.Cache} cache The cache to use when persisting
 *     credentials.
 * @return {Service_} This service, for chaining.
 * @see https://developers.google.com/apps-script/reference/cache/
 */
Service_.prototype.setCache = function(cache) {
  this.cache_ = cache;
  return this;
};

/**
 * Sets the lock to use when checking and refreshing credentials (optional).
 * Using a lock will ensure that only one execution will be able to access the
 * stored credentials at a time. This can prevent race conditions that arise
 * when two executions attempt to refresh an expired token.
 * @param {LockService.Lock} lock The lock to use when accessing credentials.
 * @return {Service_} This service, for chaining.
 * @see https://developers.google.com/apps-script/reference/lock/
 */
Service_.prototype.setLock = function(lock) {
  this.lock_ = lock;
  return this;
};

/**
 * Sets the scope or scopes to request during the authorization flow (optional).
 * If the scope value is an array it will be joined using the separator before
 * being sent to the server, which is is a space character by default.
 * @param {string|Array.<string>} scope The scope or scopes to request.
 * @param {string} [optSeparator] The optional separator to use when joining
 *     multiple scopes. Default: space.
 * @return {Service_} This service, for chaining.
 */
Service_.prototype.setScope = function(scope, optSeparator) {
  var separator = optSeparator || ' ';
  this.params_.scope = Array.isArray(scope) ? scope.join(separator) : scope;
  return this;
};

/**
 * Sets an additional parameter to use when constructing the authorization URL
 * (optional). See the documentation for your service provider for information
 * on what parameter values they support.
 * @param {string} name The parameter name.
 * @param {string} value The parameter value.
 * @return {Service_} This service, for chaining.
 */
Service_.prototype.setParam = function(name, value) {
  this.params_[name] = value;
  return this;
};

/**
 * Sets the private key to use for Service Account authorization.
 * @param {string} privateKey The private key.
 * @return {Service_} This service, for chaining.
 */
Service_.prototype.setPrivateKey = function(privateKey) {
  this.privateKey_ = privateKey;
  return this;
};

/**
 * Sets the issuer (iss) value to use for Service Account authorization.
 * If not set the client ID will be used instead.
 * @param {string} issuer This issuer value
 * @return {Service_} This service, for chaining.
 */
Service_.prototype.setIssuer = function(issuer) {
  this.issuer_ = issuer;
  return this;
};

/**
 * Sets the subject (sub) value to use for Service Account authorization.
 * @param {string} subject This subject value
 * @return {Service_} This service, for chaining.
 */
Service_.prototype.setSubject = function(subject) {
  this.subject_ = subject;
  return this;
};

/**
 * Sets number of minutes that a token obtained through Service Account
 * authorization should be valid. Default: 60 minutes.
 * @param {string} expirationMinutes The expiration duration in minutes.
 * @return {Service_} This service, for chaining.
 */
Service_.prototype.setExpirationMinutes = function(expirationMinutes) {
  this.expirationMinutes_ = expirationMinutes;
  return this;
};

/**
 * Gets the authorization URL. The first step in getting an OAuth2 token is to
 * have the user visit this URL and approve the authorization request. The
 * user will then be redirected back to your application using callback function
 * name specified, so that the flow may continue.
 * @return {string} The authorization URL.
 */
Service_.prototype.getAuthorizationUrl = function() {
  validate_({
    'Client ID': this.clientId_,
    'Script ID': this.scriptId_,
    'Callback function name': this.callbackFunctionName_,
    'Authorization base URL': this.authorizationBaseUrl_
  });

  var redirectUri = getRedirectUri(this.scriptId_);
  var state = eval('Script' + 'App').newStateToken()
      .withMethod(this.callbackFunctionName_)
      .withArgument('serviceName', this.serviceName_)
      .withTimeout(3600)
      .createToken();
  var params = {
    client_id: this.clientId_,
    response_type: 'code',
    redirect_uri: redirectUri,
    state: state
  };
  params = extend_(params, this.params_);
  return buildUrl_(this.authorizationBaseUrl_, params);
};

/**
 * Completes the OAuth2 flow using the request data passed in to the callback
 * function.
 * @param {Object} callbackRequest The request data recieved from the callback
 *     function.
 * @return {boolean} True if authorization was granted, false if it was denied.
 */
Service_.prototype.handleCallback = function(callbackRequest) {
  var code = callbackRequest.parameter.code;
  var error = callbackRequest.parameter.error;
  if (error) {
    if (error == 'access_denied') {
      return false;
    } else {
      throw new Error('Error authorizing token: ' + error);
    }
  }
  validate_({
    'Client ID': this.clientId_,
    'Client Secret': this.clientSecret_,
    'Script ID': this.scriptId_,
    'Token URL': this.tokenUrl_
  });
  var redirectUri = getRedirectUri(this.scriptId_);
  var headers = {
    'Accept': this.tokenFormat_
  };
  if (this.tokenHeaders_) {
    headers = extend_(headers, this.tokenHeaders_);
  }
  var tokenPayload = {
    code: code,
    client_id: this.clientId_,
    client_secret: this.clientSecret_,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  };
  if (this.tokenPayloadHandler_) {
    tokenPayload = this.tokenPayloadHandler_(tokenPayload);
  }
  var response = UrlFetchApp.fetch(this.tokenUrl_, {
    method: 'post',
    headers: headers,
    payload: tokenPayload,
    muteHttpExceptions: true
  });
  var token = this.getTokenFromResponse_(response);
  this.saveToken_(token);
  return true;
};

/**
 * Determines if the service has access (has been authorized and hasn't
 * expired). If offline access was granted and the previous token has expired
 * this method attempts to generate a new token.
 * @return {boolean} true if the user has access to the service, false
 *     otherwise.
 */
Service_.prototype.hasAccess = function() {
  return this.lockable_(function() {
    var token = this.getToken();
    if (!token || this.isExpired_(token)) {
      if (token && token.refresh_token) {
        try {
          this.refresh();
        } catch (e) {
          this.lastError_ = e;
          return false;
        }
      } else if (this.privateKey_) {
        try {
          this.exchangeJwt_();
        } catch (e) {
          this.lastError_ = e;
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  });
};

/**
 * Gets an access token for this service. This token can be used in HTTP
 * requests to the service's endpoint. This method will throw an error if the
 * user's access was not granted or has expired.
 * @return {string} An access token.
 */
Service_.prototype.getAccessToken = function() {
  if (!this.hasAccess()) {
    throw new Error('Access not granted or expired.');
  }
  var token = this.getToken();
  return token.access_token;
};

/**
 * Resets the service, removing access and requiring the service to be
 * re-authorized.
 */
Service_.prototype.reset = function() {
  this.getStorage().removeValue(null);
};

/**
 * Gets the last error that occurred this execution when trying to automatically
 * refresh or generate an access token.
 * @return {Exception} An error, if any.
 */
Service_.prototype.getLastError = function() {
  return this.lastError_;
};

/**
 * Returns the redirect URI that will be used for this service. Often this URI
 * needs to be entered into a configuration screen of your OAuth provider.
 * @return {string} The redirect URI.
 */
Service_.prototype.getRedirectUri = function() {
  return getRedirectUri(this.scriptId_);
};

/**
 * Gets the token from a UrlFetchApp response.
 * @param {UrlFetchApp.HTTPResponse} response The response object.
 * @return {Object} The parsed token.
 * @throws If the token cannot be parsed or the response contained an error.
 * @private
 */
Service_.prototype.getTokenFromResponse_ = function(response) {
  var token = this.parseToken_(response.getContentText());
  var resCode = response.getResponseCode();
  if ( resCode < 200 || resCode >= 300 || token.error) {
    var reason = [
      token.error,
      token.message,
      token.error_description,
      token.error_uri
    ].filter(Boolean).map(function(part) {
      return typeof(part) == 'string' ? part : JSON.stringify(part);
    }).join(', ');
    if (!reason) {
      reason = resCode + ': ' + JSON.stringify(token);
    }
    throw new Error('Error retrieving token: ' + reason);
  }
  return token;
};

/**
 * Parses the token using the service's token format.
 * @param {string} content The serialized token content.
 * @return {Object} The parsed token.
 * @private
 */
Service_.prototype.parseToken_ = function(content) {
  var token;
  if (this.tokenFormat_ == TOKEN_FORMAT.JSON) {
    try {
      token = JSON.parse(content);
    } catch (e) {
      throw new Error('Token response not valid JSON: ' + e);
    }
  } else if (this.tokenFormat_ == TOKEN_FORMAT.FORM_URL_ENCODED) {
    token = content.split('&').reduce(function(result, pair) {
      var parts = pair.split('=');
      result[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
      return result;
    }, {});
  } else {
    throw new Error('Unknown token format: ' + this.tokenFormat_);
  }
  token.granted_time = getTimeInSeconds_(new Date());
  return token;
};

/**
 * Refreshes a token that has expired. This is only possible if offline access
 * was requested when the token was authorized.
 */
Service_.prototype.refresh = function() {
  validate_({
    'Client ID': this.clientId_,
    'Client Secret': this.clientSecret_,
    'Token URL': this.tokenUrl_
  });

  this.lockable_(function() {
    var token = this.getToken();
    if (!token.refresh_token) {
      throw new Error('Offline access is required.');
    }
    var headers = {
      Accept: this.tokenFormat_
    };
    if (this.tokenHeaders_) {
      headers = extend_(headers, this.tokenHeaders_);
    }
    var tokenPayload = {
        refresh_token: token.refresh_token,
        client_id: this.clientId_,
        client_secret: this.clientSecret_,
        grant_type: 'refresh_token'
    };
    if (this.tokenPayloadHandler_) {
      tokenPayload = this.tokenPayloadHandler_(tokenPayload);
    }
    // Use the refresh URL if specified, otherwise fallback to the token URL.
    var url = this.refreshUrl_ || this.tokenUrl_;
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: headers,
      payload: tokenPayload,
      muteHttpExceptions: true
    });
    var newToken = this.getTokenFromResponse_(response);
    if (!newToken.refresh_token) {
      newToken.refresh_token = token.refresh_token;
    }
    this.saveToken_(newToken);
  });
};

/**
 * Gets the storage layer for this service, used to persist tokens.
 * Custom values associated with the service can be stored here as well.
 * The key <code>null</code> is used to to store the token and should not
 * be used.
 * @return {Storage} The service's storage.
 */
Service_.prototype.getStorage = function() {
  validate_({
    'Property store': this.propertyStore_
  });
  if (!this.storage_) {
    var prefix = 'oauth2.' + this.serviceName_;
    this.storage_ = new Storage_(prefix, this.propertyStore_, this.cache_);
  }
  return this.storage_;
};

/**
 * Saves a token to the service's property store and cache.
 * @param {Object} token The token to save.
 * @private
 */
Service_.prototype.saveToken_ = function(token) {
  this.getStorage().setValue(null, token);
};

/**
 * Gets the token from the service's property store or cache.
 * @return {Object} The token, or null if no token was found.
 */
Service_.prototype.getToken = function() {
  return this.getStorage().getValue(null);
};

/**
 * Determines if a retrieved token is still valid.
 * @param {Object} token The token to validate.
 * @return {boolean} True if it has expired, false otherwise.
 * @private
 */
Service_.prototype.isExpired_ = function(token) {
  var expiresIn = token.expires_in || token.expires;
  if (!expiresIn) {
    return false;
  } else {
    var expiresTime = token.granted_time + Number(expiresIn);
    var now = getTimeInSeconds_(new Date());
    return expiresTime - now < Service_.EXPIRATION_BUFFER_SECONDS_;
  }
};

/**
 * Uses the service account flow to exchange a signed JSON Web Token (JWT) for
 * an access token.
 * @private
 */
Service_.prototype.exchangeJwt_ = function() {
  validate_({
    'Token URL': this.tokenUrl_
  });
  var jwt = this.createJwt_();
  var headers = {
    'Accept': this.tokenFormat_
  };
  if (this.tokenHeaders_) {
    headers = extend_(headers, this.tokenHeaders_);
  }
  var response = UrlFetchApp.fetch(this.tokenUrl_, {
    method: 'post',
    headers: headers,
    payload: {
      assertion: jwt,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer'
    },
    muteHttpExceptions: true
  });
  var token = this.getTokenFromResponse_(response);
  this.saveToken_(token);
};

/**
 * Creates a signed JSON Web Token (JWT) for use with Service Account
 * authorization.
 * @return {string} The signed JWT.
 * @private
 */
Service_.prototype.createJwt_ = function() {
  validate_({
    'Private key': this.privateKey_,
    'Token URL': this.tokenUrl_,
    'Issuer or Client ID': this.issuer_ || this.clientId_
  });
  var header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  var now = new Date();
  var expires = new Date(now.getTime());
  expires.setMinutes(expires.getMinutes() + this.expirationMinutes_);
  var claimSet = {
    iss: this.issuer_ || this.clientId_,
    aud: this.tokenUrl_,
    exp: Math.round(expires.getTime() / 1000),
    iat: Math.round(now.getTime() / 1000)
  };
  if (this.subject_) {
    claimSet.sub = this.subject_;
  }
  if (this.params_.scope) {
    claimSet.scope = this.params_.scope;
  }
  var toSign = Utilities.base64EncodeWebSafe(JSON.stringify(header)) + '.' +
      Utilities.base64EncodeWebSafe(JSON.stringify(claimSet));
  var signatureBytes =
      Utilities.computeRsaSha256Signature(toSign, this.privateKey_);
  var signature = Utilities.base64EncodeWebSafe(signatureBytes);
  return toSign + '.' + signature;
};

/**
 * Locks access to a block of code if a lock has been set on this service.
 * @param {function} func The code to execute.
 * @return {*} The result of the code block.
 * @private
 */
Service_.prototype.lockable_ = function(func) {
  var releaseLock = false;
  if (this.lock_ && !this.lock_.hasLock()) {
    this.lock_.waitLock(Service_.LOCK_EXPIRATION_MILLISECONDS_);
    releaseLock = true;
  }
  var result = func.apply(this);
  if (this.lock_ && releaseLock) {
    this.lock_.releaseLock();
  }
  return result;
};

// Copyright 2017 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Contains classes used to persist data and access it.
 */

/**
 * Creates a new Storage_ instance, which is used to persist OAuth tokens and
 * related information.
 * @param {string} prefix The prefix to use for keys in the properties and
 *     cache.
 * @param {PropertiesService.Properties} properties The properties instance to
 *     use.
 * @param {CacheService.Cache} [optCache] The optional cache instance to use.
 * @constructor
 */
function Storage_(prefix, properties, optCache) {
  this.prefix_ = prefix;
  this.properties_ = properties;
  this.cache_ = optCache;
  this.memory_ = {};
}

/**
 * The TTL for cache entries, in seconds.
 * @type {number}
 * @private
 */
Storage_.CACHE_EXPIRATION_TIME_SECONDS = 21600; // 6 hours.

/**
 * Gets a stored value.
 * @param {string} key The key.
 * @return {*} The stored value.
 */
Storage_.prototype.getValue = function(key) {
  // Check memory.
  if (this.memory_[key]) {
    return this.memory_[key];
  }

  var prefixedKey = this.getPrefixedKey_(key);
  var jsonValue;
  var value;

  // Check cache.
  if (this.cache_ && (jsonValue = this.cache_.get(prefixedKey))) {
    value = JSON.parse(jsonValue);
    this.memory_[key] = value;
    return value;
  }

  // Check properties.
  if (jsonValue = this.properties_.getProperty(prefixedKey)) {
    if (this.cache_) {
      this.cache_.put(prefixedKey,
          jsonValue, Storage_.CACHE_EXPIRATION_TIME_SECONDS);
    }
    value = JSON.parse(jsonValue);
    this.memory_[key] = value;
    return value;
  }

  // Not found.
  return null;
};

/**
 * Stores a value.
 * @param {string} key The key.
 * @param {*} value The value.
 */
Storage_.prototype.setValue = function(key, value) {
  var prefixedKey = this.getPrefixedKey_(key);
  var jsonValue = JSON.stringify(value);
  this.properties_.setProperty(prefixedKey, jsonValue);
  if (this.cache_) {
    this.cache_.put(prefixedKey, jsonValue,
        Storage_.CACHE_EXPIRATION_TIME_SECONDS);
  }
  this.memory_[key] = value;
};

/**
 * Removes a stored value.
 * @param {string} key The key.
 */
Storage_.prototype.removeValue = function(key) {
  var prefixedKey = this.getPrefixedKey_(key);
  this.properties_.deleteProperty(prefixedKey);
  if (this.cache_) {
    this.cache_.remove(prefixedKey);
  }
  delete this.memory_[key];
};

/**
 * Gets a key with the prefix applied.
 * @param {string} key The key.
 * @return {string} The key with the prefix applied.
 * @private
 */
Storage_.prototype.getPrefixedKey_ = function(key) {
  if (key) {
    return this.prefix_ + '.' + key;
  } else {
    return this.prefix_;
  }
};

// Copyright 2014 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Contains utility methods used by the library.
 */

/* exported buildUrl_ */
/**
 * Builds a complete URL from a base URL and a map of URL parameters.
 * @param {string} url The base URL.
 * @param {Object.<string, string>} params The URL parameters and values.
 * @return {string} The complete URL.
 * @private
 */
function buildUrl_(url, params) {
  var paramString = Object.keys(params).map(function(key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
  }).join('&');
  return url + (url.indexOf('?') >= 0 ? '&' : '?') + paramString;
}

/* exported validate_ */
/**
 * Validates that all of the values in the object are non-empty. If an empty
 * value is found, and error is thrown using the key as the name.
 * @param {Object.<string, string>} params The values to validate.
 * @private
 */
function validate_(params) {
  Object.keys(params).forEach(function(name) {
    var value = params[name];
    if (!value) {
      throw Utilities.formatString('%s is required.', name);
    }
  });
}

/* exported getTimeInSeconds_ */
/**
 * Gets the time in seconds, rounded down to the nearest second.
 * @param {Date} date The Date object to convert.
 * @return {Number} The number of seconds since the epoch.
 * @private
 */
function getTimeInSeconds_(date) {
  return Math.floor(date.getTime() / 1000);
}

/* exported extend_ */
/**
 * Copy all of the properties in the source objects over to the
 * destination object, and return the destination object.
 * @param {Object} destination The combined object.
 * @param {Object} source The object who's properties are copied to the
 *     destination.
 * @return {Object} A combined object with the desination and source
 *     properties.
 * @see http://underscorejs.org/#extend
 */
function extend_(destination, source) {
  var keys = Object.keys(source);
  for (var i = 0; i < keys.length; ++i) {
    destination[keys[i]] = source[keys[i]];
  }
  return destination;
}

   /****** code end *********/
   ;(
function copy(src, target, obj) {
    obj[target] = obj[target] || {};
    if (src && typeof src === 'object') {
        for (var k in src) {
            if (src.hasOwnProperty(k)) {
                obj[target][k] = src[k];
            }
        }
    } else {
        obj[target] = src;
    }
}
   ).call(null, module.exports, expose, host);
}).call(this, this, "OAuth2");
//////////////////////////////////////////////
//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));
