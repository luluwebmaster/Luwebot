/**
	Include libraries
*/

//Include express
var app = require('express')();

//Server
var server = require('http').Server(app);

//MySQL Dada Base
var mysql = require('mysql');

//Another Modules
var request = require('request');
var cheerio = require('cheerio');
var url = require('url');
var cType = require('content-type');

/**
	Connect to SQL data base
*/

//Set data base config
var db_config = {
	'host' : 'localhost',
	'user' : 'root',
	'password' : '',
	'database' : 'luwebot'
};
bdd = mysql.createConnection(db_config);
bdd.connect();
setInterval(function () {
    bdd.query('SELECT 1');
}, 30000);

/**
	Variables list
*/

linksInSave = false;

/**
	Functions list
*/

//Function for test if value is in array
function inArray(needle, haystack)
{
    var count=haystack.length;
    for(var i=0;i<count;i++)
    {
        if(haystack[i]===needle){return true;}
    }
    return false;
}

//Function for generate uid
function uid()
{
	function s4()
	{
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	}
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

//Principal function for index datas
function indexerData(callback)
{
	
	//Test if valid callback
	if(typeof callback === "function")
	{
		
		//Get url in data base
		bdd.query("SELECT*FROM waiting_list WHERE checked=? ORDER BY id ASC LIMIT 0,1", [false], function (error, response){
			
			//If found url
			if(response[0] !== undefined)
			{
				
				//Set variables
				var urlGet = response[0]['url'];
				var parsedUrl = url.parse(urlGet);
				var urlHostname = parsedUrl['hostname'];
				var urlPath = parsedUrl['path'];
				if(parsedUrl['search'] !== null)
				{
					urlPath = urlPath+parsedUrl['search'];
				}
				
				//Send request to get data
				request.get(urlGet, function (error, response, body){
					
					//Set variables
					if(response !== undefined)
					{
						
						var reqStatusCode = response.statusCode;
						
						if(response.headers['content-type'] !== undefined && response.headers['content-type'] !== "")
						{
							
							var reqContentType = cType.parse(response.headers['content-type']);
						}
						else
						{
							reqContentType = undefined;
						}
					}
					
					//If as a error
					if(error == null && response !== undefined && reqContentType !== undefined && reqContentType['type'] == "text/html" && body.substring(0, 100).search(/<!DOCTYPE html>/i) <= 0)
					{
						
						//Link start save
						linksInSave = true;
						
						//Html data
						var html = body;
						
						//Load website content
						$ = cheerio.load(html);
						
						//Website infos
						var title = $('title').html();
						var description = $('meta[name="description"]').attr('content');
						var hrefList = [];
						
						//Call "Callback" function
						callback(false, urlGet, title);
						
						/**
							Get list link in website
						*/
						
						console.log('\n-----------------------------------------------------------------\n Links founds\n-----------------------------------------------------------------\n ♦\n  ♦');
						$('a').each(function (index){
							
							if($(this).attr('href') !== undefined)
							{
								
								var hrefLink = $(this).attr('href');
								
								var hrefData = url.parse(hrefLink);
								
								if(hrefData['protocol'] !== "javascript:")
								{
									
									if(hrefData['host'] == null)
									{
										
										if(hrefLink.substring(0, 1) == "/")
										{
											
											hrefLink = urlHostname+hrefLink;
										}
										else
										{
											
											hrefLink = urlHostname+'/'+hrefLink;
										}
										
										if(parsedUrl['protocol'] == "https:")
										{
											
											hrefLink = 'https://'+hrefLink;
										}
										else if(hrefData['protocol'] == "http:" || hrefData['protocol'] == "" || hrefData['protocol'] == null)
										{
											
											hrefLink = 'http://'+hrefLink;
										}
										else
										{
											
											hrefLink = undefined;
										}
									}
									
									if(hrefData['search'] !== null)
									{
										hrefLink = hrefLink+hrefData['search'];
									}
									
									hrefData = url.parse(hrefLink);
									
									if(hrefLink !== undefined && !inArray(hrefLink, hrefList) && hrefData['hostname'] !== null && hrefData['pathname'] !== null)
									{
										
										
										hrefLink = hrefData['hostname']+hrefData['pathname'].replace('//', '/');
										
										if(hrefData['protocol'] == "https:")
										{
											
											hrefLink = 'https://'+hrefLink;
										}
										else if(hrefData['protocol'] == "http:" || hrefData['protocol'] == "" || hrefData['protocol'] == null)
										{
											
											hrefLink = 'http://'+hrefLink;
										}
										
										if(hrefData['search'] !== null)
										{
											hrefLink = hrefLink+hrefData['search'];
										}
										
										hrefList.push(hrefLink);
										hrefConsoleLink = hrefLink;
										
										if(hrefConsoleLink.length >= 100)
										{
											hrefConsoleLink = hrefConsoleLink.substring(0, 100)+" [...]";
										}
										
										console.log('   ♦ '+hrefLink);
									}
								}
							}
						});
						if(hrefList.length <= 0)
						{
							console.log('   ♦ No link found !');
						}
						console.log('  ♦\n ♦\n-----------------------------------------------------------------\n End of links founds\n-----------------------------------------------------------------\n');
						
						/**
							Index data
						*/
						
						//Check if website is saved in data base
						bdd.query("SELECT*FROM sites_list WHERE hostname=?", [urlHostname], function (error, response){
							
							//If hostname is saved, get uid
							if(response[0] !== undefined)
							{
								
								var hostUid = response[0]['uid'];
							}
							//Else, save website and get uid
							else
							{
								
								var hostUid = uid();
								
								bdd.query("INSERT INTO sites_list (uid, hostname) VALUES (?, ?)", [hostUid, urlHostname], function (error, response){
									
									//Log
									console.log('New website saved : '+urlHostname);
								});
							}
							
							//Check if path is not saved
							bdd.query("SELECT*FROM index_list WHERE site_uid=? AND path=?", [hostUid, urlPath], function (error, response){
								
								if(response[0] == undefined)
								{
									
									//Use the uid for save index page
									bdd.query("INSERT INTO index_list (uid, site_uid, path, title, description) VALUES (?, ?, ?, ?, ?)", [
										uid(),
										hostUid,
										urlPath,
										title,
										description
									], function (){
										
										//Log
										console.log('The url "'+urlGet+'" ( "'+title+'" ) was indexed in data base.');
									});
								}
							});
						});
						
						/**
							Update chcked value
						*/
						
						bdd.query("UPDATE waiting_list SET checked=? WHERE url=?", [
							true,
							urlGet
						]);
						
						/**
							Save all links found in website
						*/
						
						var idHref = 0;
						var inRequest = false;
						var linkListSaved = false;
						
						//Interval
						var intervalSave = setInterval(function (){
							
							//If request started
							if(inRequest == false)
							{
								
								//Variables
								var hrefLink = hrefList[idHref];
								inRequest = true;
								
								//Check if urls is saved
								if(hrefLink !== undefined)
								{
									bdd.query("SELECT*FROM waiting_list WHERE url=?", [hrefLink], function (error, response){
										
										//If not found, save this
										if(response[0] == undefined)
										{
											
											bdd.query("INSERT INTO waiting_list (uid, url, checked) VALUES (?, ?, ?)", [
												uid(),
												hrefLink,
												false
											], function (error, response){
												
												//Timeout for avoid crash data base
												setTimeout(function (){
													
													if(linkListSaved == false)
													{
														
														//Log
														linkListSaved = true;
														console.log('\n-----------------------------------------------------------------\n Links saveds\n-----------------------------------------------------------------\n ♦\n  ♦');
													}
													
													//Reset request
													inRequest = false;
													
													//Increment
													idHref++;
													
													//Log
													var hrefConsoleLink = hrefLink;
													
													if(hrefConsoleLink.length >= 100)
													{
														hrefConsoleLink = hrefConsoleLink.substring(0, 100)+" [...]";
													}
													
													console.log('   ♦ '+hrefConsoleLink);
												}, 10);
											});
										}
										else
										{
											
											//Reset request
											inRequest = false;
											
											//Increment
											idHref++;
										}
									});
								}
								else
								{
									
									//Reset request
									inRequest = false;
									
									//Increment
									idHref++;
								}
								
								//If end of request
								if(idHref >= hrefList.length)
								{
									
									clearInterval(intervalSave);
									linksInSave = false;
									
									if(linkListSaved <= 0)
									{
										console.log('\n-----------------------------------------------------------------\n Links saveds\n-----------------------------------------------------------------\n ♦\n  ♦');
										console.log('   ♦ No link saved !');
									}
									
									//Log
									console.log('  ♦\n ♦\n-----------------------------------------------------------------\n End of links saveds\n-----------------------------------------------------------------\n');
								}
							}
						}, 1);
					}
					else
					{
						
						//Check url
						bdd.query("UPDATE waiting_list SET checked=? WHERE url=?", [
							true,
							urlGet
						]);
						
						//Call "Callback" function
						callback("Request can't executed.", urlGet, false);
					}
				});
			}
			else
			{
				
				//Call "Callback" function
				callback("Can't found new url.", urlGet, false);
			}
		});
	}
}

/**
	Strating bot
*/

//Default variables
var pause = false;
var pauseErrors = false;
var timerSearch = 0;

//Interval for bot
setInterval(function (){
	
	//If bot is not doing save links
	if(linksInSave == false)
	{
		
		//If bot as not request started
		if((pause == false && pauseErrors == false) || (pauseErrors == true && timerSearch == 5000))
		{	
			
			//Define this variable to true for say that the bot as a request started
			pause = true;
			
			//Execute indexing code
			indexerData(function (error, url, title){
				
				//If not have a error
				if(error == false)
				{
					
					console.log('Succes get page ( '+title+' ) : '+url);
					pauseErrors = false;
				}
				//If have a error
				else
				{
				
					console.log('Error : '+error);
					pauseErrors = true;
				}
				
				//Request finish
				pause = false;
			});
		}
		
		//Reset timer if necessary
		if(timerSearch > 5000)
		{
			timerSearch = 0;
		}
		
		//Auto increment timer
		timerSearch++;
	}
}, 1);

//Log the starting bot
console.log('Starting bot !');