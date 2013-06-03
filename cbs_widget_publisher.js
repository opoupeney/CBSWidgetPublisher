/*
	Widget Publisher
	(c) 2013 - Capital Banking Solutions
*/

/*
 * Configuration:
 * 		DATA_QUERY_NAME - main Data Query name
 * 		CONTEXT_VALUE - context object to take client ID
 * 		IMAGES_URL - images folder URL
 * 		GENERATE_WIDGET_EVENT - event to generate widget publisher in DataWidgetRenderer
 * 		NO_DATA_MESSAGE - message 'no data found' taken from the dictionary
 * 
 * 		Passing sheet name parameter:
 * 			this.cbsWsSettings.sheetname = this.dataWidget.parameters.pkName;
 */

/*
 * Notes:
 * 1) Rows number is never more than 2000. So, it's useless to implement 'paging' mechanism for the performance.
 * 2) Probably, it makes sense to add a 'PagingToolbar' but anyway, all the data are downloading in one request.
 */

/*
 * Widget entry point. 
 */
function cbsWidgetPublisher(dataWidget, cbs_publisher_instance, cbsWsSettings) {
	//console.log(dataWidget.parameters);
	showCbsWaitMessage();
	
	if (cbs_publisher_instance == undefined || cbs_publisher_instance == null) {// called externally
		dataWidget.clearContent();
		var wgt_placeholder_id = Math.uuid( 10,10 );
		
		if ($(".cbsPublisherToDelete")[0]){
			$('.cbsPublisherToDelete').remove();
		}
		dataWidget.addContent("<div id=\"" + wgt_placeholder_id + "\" class = \"cbsPublisherToDelete\" style=\"width:100%;height:auto;\"></div>");
		
		var cbsPublisher = new CBSPublisher(dataWidget, wgt_placeholder_id, new CbsWsSettings());
		cbsPublisher.executeFromExternalCall();
	} 
	else {// called internally
		if (cbsWsSettings.newScreen !== true) {// the same publisher, refresh current screen - e.g. select new Combobox value
			cbs_publisher_instance.init(dataWidget, cbs_publisher_instance.wgt_placeholder_id, cbsWsSettings);// reset the curernt publisher data
			cbs_publisher_instance.executeFromInternalCall();
		}
	}
}

var PLEASE_WAIT_CBS_WINDOW = null;
function showCbsWaitMessage() {
	PLEASE_WAIT_CBS_WINDOW = Ext.MessageBox.show({ 
		msg: 'Loading the requested information...', 
		progressText: 'Retrieving data...', 
		width:300,
		wait:true, 
		waitConfig: {interval:1000}
	});
}
function closeCbsWaitMessage() {
	if (PLEASE_WAIT_CBS_WINDOW)
		PLEASE_WAIT_CBS_WINDOW.hide();
}

/*
 * Displays the next report calling WS with dynamically defined parameters.
 * Called only internally, e.g. click on the Grid row - builds new publisher instance and dispalys new screen.
 */
function cbsWidgetPublisherNextScreen(wsParamsAsString, prevPlaceholderInfo, dataWidgetName) {
	// preparing the WS parameters JSON object
	var wsParamsJsonObj = new Object();
	var wsParamsArray = wsParamsAsString.split('|');
	var wsGeneralParamsArray = wsParamsArray[0].split(';');
	var wsPassedParamsArray = wsParamsArray[1].split(';');
	
	wsParamsJsonObj.usr = wsGeneralParamsArray[0];
	wsParamsJsonObj.lng = wsGeneralParamsArray[1];
	wsParamsJsonObj.roles = wsGeneralParamsArray[2];
	wsParamsJsonObj.newScreen = true;
	wsParamsJsonObj.sheetname = wsPassedParamsArray[2];
	wsParamsJsonObj.client = wsPassedParamsArray[3];
	wsParamsJsonObj.dataWidgetName = dataWidgetName;
	
	// parameters 'p1'...'p5'
	for (var i = 5; i < wsPassedParamsArray.length; i++) {
		wsParamsJsonObj["p" + (i-4)] = wsPassedParamsArray[i];
	}
	
	$("#" + prevPlaceholderInfo.IDs[prevPlaceholderInfo.IDs.length-1]).hide("slide", { direction: "left" }, 500, function() {});// hide previous
	
	// new publisher, new screen - e.g. click on the Grid row
	var wgt_placeholder_id = Math.uuid( 10,10 );
	var dataWidget = dfGetDataWidget(dataWidgetName);
	dataWidget.addContent("<div id=\"" + wgt_placeholder_id + "\" style=\"width:100%;height:auto;\"></div>");
	
	showCbsWaitMessage();

	var cbsPublisher = new CBSPublisher(dataWidget, wgt_placeholder_id, wsParamsJsonObj);
	cbsPublisher.setPrevWgtPlaceholderInfo(prevPlaceholderInfo);// store prev_wgt_placeholder_info for 'back' button
	cbsPublisher.executeFromInternalCall();
}

/*
 * Class to store the WS settings.
 */
function CbsWsSettings() {
	this.usr = null;
	this.lng = null;
	this.roles = null;
	this.client = null;
	this.sheetname = null;
	this.newScreen = true;
}

CbsWsSettings.prototype.type="CbsWsSettings";

/*
 * Main class - creates and dispalys all kinds of reports.
 */
function CBSPublisher(dataWidget, wgt_placeholder_id, cbsWsSettings) {
	this.init(dataWidget, wgt_placeholder_id, cbsWsSettings);
	this.prev_wgt_placeholder_info = new Object();
	this.prev_wgt_placeholder_info.IDs = new Array();
	this.prev_wgt_placeholder_info.repTitles = new Array();
	return this;
}

CBSPublisher.prototype.type="CBSPublisher";

CBSPublisher.prototype.init = function(dataWidget, wgt_placeholder_id, cbsWsSettings) {
	// constants
	this.DATA_QUERY_NAME = "qWidgetPublisher";
	this.PUBLISHER_DATA_QUERY_NAME = "qWidgetPublisherData";
	this.CONTEXT_VALUE = {object_name: "CgbContext", object_value: "clientId"};
	this.IMAGES_URL = "/CBSCloud/res/cb/images/publisher/";//"http://localhost:8080/RestFixture/images/";
	this.GENERATE_WIDGET_EVENT = "CgbGenerateScreen";
	this.CONTEXT_VALUE_WGT_CALL = {object_name: "CgbCheckBookRequest", object_value: "rowId"};
	this.SHEET_NAME_PARAMETER = "pkName";
	
	this.POSSIBLE_TREE_LEVELS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
	this.GRID_SYSTEM_COLUMNS = ['row_id', 'long_descr', 'caction', 'rep_icon'];
	
	this.NO_DATA_MESSAGE = "&nbsp;No data found";
	try {
		this.NO_DATA_MESSAGE = dictionary.terms.CBS.no_data_found;
	} catch(e) {
		console.log('There is no dictionary.terms.CBS.no_data_found');
	}
	
	// general data
	this.dataWidget = dataWidget;
	this.wgt_placeholder_id = wgt_placeholder_id;
	this.cbsWsSettings = cbsWsSettings;
	this.items = null;
	this.maxWidgetHeight = $(window).height() - 170;// minus footer+header
	this.maxWidgetWidth = $(window).width() - 120;// minus left menu
	this.mainTreeGridWidth = null;
	
	// zero level
	this.error = new Object();
	this.normalFormLevel_0 = new Array();// Array of {label, data}
	this.collapsedFormLevel_0_title = null;
	this.collapsedFormLevel_0 = new Array();// Array of {label, data}
	
	// first level - grid
	this.reportName = '';
	this.isItTree = false;
	this.gridColumns = new Array();
	this.gridFields_level_1 = new Array();
	this.gridData_level_1 = new Array();
	
	// first level - dimension links
	this.dimensionLinks = new Array();
	
	// first level - charts
	this.chartsLevel_1 = new Object();
	this.chartsLevel_1.reportName = null;
	/*
	Dynamically created properties:
		this.chartsLevel_1.chart_[parentIndex].[chartName].type.pie: Boolean (there is also type.line & type.bar)
		this.chartsLevel_1.chart_[parentIndex].[chartName].label: String
		this.chartsLevel_1.chart_[parentIndex].[chartName].graphType: String
		this.chartsLevel_1.chart_[parentIndex].[chartName].series: Array of {c01, c02, c03}
		
		chartName - PA, PB..., LA, LB...
	*/
	
	// second level - charts
	this.chartsLevel_2 = new Object();
	this.chartsLevel_2.reportName = null;
	
	// second level - tabs
	this.gridsOrFormsLevel_2 = new Object();
	/*
	Dynamically created properties:
		this.gridsOrFormsLevel_2.reportName_10: String
		this.gridsOrFormsLevel_2.gridColumns_10: Array of {header, dataIndex}
		this.gridsOrFormsLevel_2.gridFields_10: Array of {name}
		this.gridsOrFormsLevel_2.gridData_10: Array of {parentIndex, row}
		this.gridsOrFormsLevel_2.formData_10: Array of {parentIndex, label, data}
		
		this.gridsOrFormsLevel_2.reportName_11, 12, 13... etc.
	*/
	
	this.lastParentIndex = 0;// variable mapping the second and first levels data
	
	// graphical component ids
	this.mainPanelId = "cbsPublisherMainPanel_" + this.wgt_placeholder_id;
	this.mainTitleId = "cbsPublisherMainTitle_" + this.wgt_placeholder_id;
	this.backLinkId = "cbsPublisherBackLink_" + this.wgt_placeholder_id;
	this.normalFormId = "cbsPublisherNormalForm_" + this.wgt_placeholder_id;
	this.collapsedFormId = "cbsPublisherCollapsedForm_" + this.wgt_placeholder_id;
	this.collapsedFormPanelId = "cbsPublisherCollapsedFormAndCharts_" + this.wgt_placeholder_id;
	this.periodDimensionsId = "cbsPublisherPeriodDimensions_" + this.wgt_placeholder_id;
	this.errorMessageId = "cbsPublisherErrorMessage_" + this.wgt_placeholder_id;
	this.mainTreeId = "cbsPublisherMainTree_" + this.wgt_placeholder_id;
	this.mainGridId = "cbsPublisherMainGrid_" + this.wgt_placeholder_id;
	this.chartsPanelId = "cbsPublisherChartsPanel_" + this.wgt_placeholder_id;
	this.secondLevelTabsId = "cbsPublisherSecondLevelTabPanel_" + this.wgt_placeholder_id;
	this.nextScreenIconId = "nextScreenIcon_" + this.wgt_placeholder_id;
	this.contextMenuIconId = "contextMenuIcon_" + this.wgt_placeholder_id;
	this.searchDetailsIconId = "searchDetailsIcon_" + this.wgt_placeholder_id;
	this.gridTreeAndChartsId = "cbsPublisherGridTreeAndCharts_" + this.wgt_placeholder_id;
	
	return this;
}

CBSPublisher.prototype.setItems = function(items) {
	this.items = items;
}

CBSPublisher.prototype.setPrevWgtPlaceholderInfo = function(prevPlaceholderInfo) {
	$.extend(this.prev_wgt_placeholder_info.IDs, prevPlaceholderInfo.IDs);
	$.extend(this.prev_wgt_placeholder_info.repTitles, prevPlaceholderInfo.repTitles);
}

CBSPublisher.prototype.executeFromExternalCall = function() {
	var cbs_publisher_instance = this;
	
	// PRODUCTION: init the WsSettings (and external report back link) using externally passed parameters
	this.cbsWsSettings.usr = user.properties.cas_attr.loginShell;
	this.cbsWsSettings.lng = user.properties.cas_attr.preferredLanguage;
	this.cbsWsSettings.roles = 'r';
	this.cbsWsSettings.sheetname = this.dataWidget.parameters[this.SHEET_NAME_PARAMETER];
	if ( appcontext[this.CONTEXT_VALUE.object_name] )
		this.cbsWsSettings.client = appcontext[this.CONTEXT_VALUE.object_name][this.CONTEXT_VALUE.object_value];// get the clienId from the context
	
	// DEBUGGING: hard code WsSettings (and external report back link) for testing
//	this.cbsWsSettings.usr = 'SAUDI';//'MPELPEL';
//	this.cbsWsSettings.lng = 'en';
//	this.cbsWsSettings.roles = 'r';
	
	//this.cbsWsSettings.client = null;
	//this.cbsWsSettings.client = 'CKHABBAZ';
//	this.cbsWsSettings.client = '021249';
//	this.cbsWsSettings.client = 'SAUDI';
//	this.cbsWsSettings.client = '741017';
//	this.cbsWsSettings.client = '723867';

//	this.cbsWsSettings.sheetname = 'pk_dp_client.f_get_synthese_client';//0
//	this.cbsWsSettings.sheetname = 'pk_dp_encours.get_encours_cli';//1 - Good to test and to show
//	this.cbsWsSettings.sheetname = 'pk_dp_signalitique.F_get_signcli';//2
//	this.cbsWsSettings.sheetname = 'pk_dp_freshmoney.f_get_freshcli';//3 - Good to test - test col size
//	this.cbsWsSettings.sheetname = 'pk_dp_statoper.get_opers_cli';//4 - Bar charts
//	this.cbsWsSettings.sheetname = 'pk_dp_dastat.f_get_client';//5 - Good to show
//	this.cbsWsSettings.sheetname = 'pk_dp_depass.get_depass_cli';//6 - optional
//	this.cbsWsSettings.sheetname = 'pk_dp_impas.f_get_impascli';//7
//	this.cbsWsSettings.sheetname = 'pk_dp_bale2.f_get_client';//8 - test col size
//	this.cbsWsSettings.sheetname = 'pk_dp_oper.get_clioper';//9
//	this.cbsWsSettings.sheetname = 'pk_dp_dpoper.get_clioper_new';//10
//	this.cbsWsSettings.sheetname = 'pk_dp_roles.F_get_roles';// ERROR - FUNCTIONAL
//	this.cbsWsSettings.sheetname = 'pk_dp_groupes.F_get_groupes';//11
//	this.cbsWsSettings.sheetname = 'pk_dp_freshmoney.f_get_freshrm';//12
//	this.cbsWsSettings.sheetname = 'PK_DP_DEMCHQ_TREE.report';//13 - demande cheque, client must be 741017
//	this.cbsWsSettings.sheetname = 'pk_dp_bale2.f_get_bale2rm';//14
//	this.cbsWsSettings.sheetname = 'pk_dp_oper.f_get_operssummaryrm';//15
//	this.cbsWsSettings.sheetname = 'pk_dp_encours.get_encours';//16
//	this.cbsWsSettings.sheetname = 'pk_dp_depass.f_get_depassrm';
//	this.cbsWsSettings.sheetname = 'pk_dp_oper.get_oper';
//	this.cbsWsSettings.sheetname = 'pk_dp_statoper.f_get_opersrm';
//	this.cbsWsSettings.sheetname = 'pk_dp_demchq_tree.report';
	
	// build the report
	cbs_publisher_instance.buildReport(true);
}

CBSPublisher.prototype.executeFromInternalCall = function() {
	this.buildReport(false);
}

CBSPublisher.prototype.buildReport = function(isCalledExternally) {
	var cbs_publisher_instance = this;
	
	var dq = (isCalledExternally === true) ? new DataQuery(this.DATA_QUERY_NAME) : new DataQuery(this.PUBLISHER_DATA_QUERY_NAME);
	dq.setParameters(this.cbsWsSettings);
	console.log(dq);
	
	dq.execute(null, function(dataSet) {
		var buffer = dataSet.getData();
		if ( buffer !== null && buffer["coResultVal"] !== null ) {
			var items = null;
			if (buffer[0] !== null && buffer[0] !== undefined)
				items = buffer[0].coResultVal;
			else
				items = buffer.coResultVal;
			
			var parseContinue = true;
			var parseIndex = 0;
			var loopIndex = 0;
			var loopLimit = 2000;
			
			cbs_publisher_instance.setItems(items);
			
			while (parseContinue) {
				loopIndex++;
				if (items[parseIndex]) {
					parseIndex = cbs_publisher_instance.parseItem(items[parseIndex], parseIndex);
					if ( parseIndex >= items.length || loopIndex > loopLimit ) {
						parseContinue = false;
					}	
				}
				else {// only one element instead of an Array
					cbs_publisher_instance.parseItem(items, 0);
					parseContinue = false;
				}
			}
			cbs_publisher_instance.gridColumns.push({ header: "", dataIndex: "caction", width: 34, align: "center" });
			cbs_publisher_instance.gridFields_level_1.push({ name: "caction" });
			
			if (cbs_publisher_instance.cbsWsSettings.newScreen) {
				var reportItems = cbs_publisher_instance.renderReport();
			}
			else {
				cbs_publisher_instance.refreshReport();
			}
		}
	});
}

CBSPublisher.prototype.parseItem = function(item, index) {
	var cbs_publisher_instance = this;
	var nextIndex = index+1;
	
	// there is an ERROR
	if (item.dimName === "-E") {
		this.error.exists = true;
		this.error.code = item.c01;
		this.error.description = item.c02;
		this.error.explanation = item.c03;
	}
	// ZERO LEVEL - General forms
	else if (item.dimName === "0" || item.dimName === "-6") {
		var formData = item.c03;
		if (formData === null || formData === undefined || formData === "null" || formData === "undefined")
			formData = "";
		
		var formLabel = item.c02;
//		if (formLabel !== null && formLabel !== undefined && formLabel !== "null" && formLabel !== "undefined") {
//			if (Ext.String.trim(formLabel).length > 0) {
				if (item.dimName === "0")
					this.normalFormLevel_0.push({ label: formLabel, data: formData });
				else if (item.dimName === "-6")
					this.collapsedFormLevel_0.push({ label: formLabel, data: formData });
//			}
//		}
	}
	// FIRST LEVEL - Main Grid
	else if (item.dimName === "CR") {
		this.setReportName( item.c01 );
		
		this.collapsedFormLevel_0_title = item.c11;
		
		this.isItTree = (item.c13 == 'N') ? true : false;// is it Tree?
		
		// Prevent the WS bug: if there was already 'CR' - delete it
		if (this.gridColumns.length > 0) {
			this.gridColumns = new Array();
			this.gridFields_level_1 = new Array();
		}
		
		// ID column - used to map the first & second levels
		this.gridColumns.push({ header: "row_id", dataIndex: "row_id", hidden: true });
		this.gridFields_level_1.push({ name: "row_id" });
		
		// add a column for the tooltip
		this.gridColumns.push({ header: "Long Description", dataIndex: "long_descr", hidden: true });
		this.gridFields_level_1.push({ name: "long_descr" });
		
		// add or not the icon column
		if ( item.c04 === 'Y' ) {
			this.gridColumns.push({ header: "", dataIndex: "rep_icon", width: 30 });
			this.gridFields_level_1.push({ name: "rep_icon" });
		}
		
		// label for the dimention links drop-down list
		this.dimensionLinks.label = item.c10;
	}
	else if (item.dimName === "CT") {
		var colIndex = this.gridFields_level_1.length - 1;// minus 1, because we always have 2 columns: row_id & long_descr
		if (this.gridColumns[2] !== undefined && this.gridColumns[2].dataIndex === 'rep_icon')// there is already rep_icon column
			colIndex = colIndex - 1;
		
		// renderer to display the Tool-tip
		var columnRenderer = function(value, meta, record) {
			if (record.data.long_descr !== undefined && record.data.long_descr !== "undefined")
				meta.tdAttr = 'data-qtip="' + record.data.long_descr + '"';
            return value;
        };
        
        // prepare the column definiiton
        var colDef = {header: item.c02, dataIndex: "c"+colIndex, renderer: columnRenderer};
        if (colIndex === 1 && this.isItTree === true){
        	colDef.xtype = 'treecolumn';
        }
        
        colDef.align = (item.c03 === "double") ? "right" : "left";
        colDef.widthToCalc = item.c05;
        colDef.resizable = true;
//        colDef.flex = 1;

        this.gridColumns.push(colDef);
		this.gridFields_level_1.push( {name: "c"+colIndex} );
	}
	else if (item.dimName === "-0") {// dimension links
		// preparing the WS parameters JSON object
		var wsParamsJsonObj = new Object();
		wsParamsJsonObj.usr = this.cbsWsSettings.usr;
		wsParamsJsonObj.lng = this.cbsWsSettings.lng;
		wsParamsJsonObj.roles = this.cbsWsSettings.roles;
		wsParamsJsonObj.newScreen = false;
		wsParamsJsonObj.sheetname = item.c03;
		wsParamsJsonObj.client = item.c04;
		
		// parameters 'p1'...'p5'
		for (var i = 6; i < 11; i++) {
			var nextP = (i<10) ? item["c0"+i] : item["c"+i];
			if (nextP !== undefined)
				wsParamsJsonObj["p" + (i-5)] = nextP;
		}
		
		if (wsParamsJsonObj.p1 === undefined)
			wsParamsJsonObj.p1 = wsParamsJsonObj.client;// if there is no c06, parameter p1 must be filled with client id anyway
		
		this.dimensionLinks.push({ title: item.c02, period: item.c01, wsParams: wsParamsJsonObj });
	}
	else if (Ext.Array.contains(this.POSSIBLE_TREE_LEVELS, item.dimName) && item.dimName.length === 1) {
		var row = new Object();
		row.row_id = item.id;
		
		// main data columns
		for (var i=1; i<this.gridFields_level_1.length; i++) {
			row["c"+i] = (i<10) ? item["c0"+i] : item["c"+i];
			if (row["c"+i] == undefined) row["c"+i] = '';
		}
		
		if (this.isItTree)
			row.level = parseInt( item.dimName );
		
		// add a data to the search details column
		if ( this.items[index+1] ) {
			if (Ext.Array.contains(this.POSSIBLE_TREE_LEVELS, this.items[index+1].dimName.substring(0, 1)) && this.items[index+1].dimName.length > 1)
				if (this.items[index+1].dimName.substring(0, 1) !== "0") {
					row.caction = "<img src='images/studio/bullet/dfs_search_sel.png' id='" + this.searchDetailsIconId + "'/>";
				}
		} else {
			row.caction="";
		}
		
		// add a data to the icon column
		if (this.gridColumns[2] !== undefined && this.gridColumns[2].dataIndex === 'rep_icon') {
			row.rep_icon = "<img src='" + this.IMAGES_URL + item.img + ".png' />";
		}
		row.long_descr = item.c16;// add a data to the tooltip column
		this.buildNextScreenLink(item, row);// add the data for the "NextScreen icon"
		this.gridData_level_1.push( row );// add the row to the grid
		this.lastParentIndex = row.row_id;// last possible parent for the second level rows
	}
	// FIRST & SECOND LEVELS - Charts
	else if (item.dimName === "D09") {
		this.chartsLevel_1.reportName = item.c01;
	}
	else if (item.dimName.indexOf("D") === 0 && item.dimName.indexOf("9") === 2) {
		this.chartsLevel_2.reportName = item.c01;
	}
	else if (item.dimName.indexOf("9") === 1) {
		var levelIdx = item.dimName.substring(0, 1);
		levelIdx = (item.dimName.substring(0, 1) === "0") ? 1 : 2;
		var parentIndex = (levelIdx === "1") ? 0 : this.lastParentIndex;
		
		if (this["chartsLevel_" + levelIdx]["chart_" + parentIndex] == undefined)
			this["chartsLevel_" + levelIdx]["chart_" + parentIndex] = new Object();
		
		if (this["chartsLevel_" + levelIdx]["chart_" + parentIndex]["chart_" + item.c05] == undefined)
			this["chartsLevel_" + levelIdx]["chart_" + parentIndex]["chart_" + item.c05] = new Object();
		
		var currentChart = this["chartsLevel_" + levelIdx]["chart_" + parentIndex]["chart_" + item.c05];
		
		if (item.c05.indexOf("P") === 0)
			currentChart.pie = true;
		else if (item.c05.indexOf("L") === 0)
			currentChart.line = true;
		else if (item.c05.indexOf("B") === 0)
			currentChart.bar = true;
		
		if (item.c01 === "label")// unfortunately, new WS format does not include these hints!
			currentChart.label = item.c02;
		//else if (item.c01 === "graphType")// unfortunately, new WS format does not include these hints!
		//	currentChart.graphType = item.c02;
		else {
			// because new WS format does not include the hints, system has to guess if it's a Date or Numbers!
			// so, the system suppose that Date is ALWAYS in the format: DD.MM.YYYY!
			var tempDate1 = Ext.Date.parse(item.c01, "d.m.Y");
			var tempDate2 = Ext.Date.parse(item.c01, "d-M-y");
			var tempDate3 = Ext.Date.parse(item.c01, "m.Y");
			if (tempDate1 || tempDate2 || tempDate3)
				currentChart.graphType = "date";
			else
				currentChart.graphType = "number";
			
			if (item.c01 !== "graphType") {// prevent adding data in case of the old format
				if (currentChart.series == undefined)
					currentChart.series = new Array();

				var chartData = item.c03;
				if (chartData && chartData.indexOf('.') === 0)
					chartData = '0' + chartData;
				
				if (chartData)
					currentChart.series.push({ c01: item.c01, c02: item.c02, c03: chartData });
			}
		}
	}
	// SECOND LEVEL - Tabs
	else if (item.dimName.indexOf("D") === 0) {
		var tab_idx = item.dimName.substring(1, 3);
		this.gridsOrFormsLevel_2["reportName_" + tab_idx] = item.c01;
	}
	else if (item.dimName.indexOf("C") === 0) {
		var tab_idx = item.dimName.substring(1, 3);
		
		if (this.gridsOrFormsLevel_2["gridColumns_" + tab_idx] == undefined) {
			this.gridsOrFormsLevel_2["gridColumns_" + tab_idx] = new Array();
			this.gridsOrFormsLevel_2["gridFields_" + tab_idx] = new Array();
		}
		
		var colAlign = (item.c03 === "double") ? "right" : "left";
		var colIndex = this.gridsOrFormsLevel_2["gridColumns_" + tab_idx].length;
		this.gridsOrFormsLevel_2["gridColumns_" + tab_idx].push({ header: item.c02, dataIndex: "c"+(colIndex+1), align: colAlign });
		this.gridsOrFormsLevel_2["gridFields_" + tab_idx].push({ name: "c"+(colIndex+1) });
	}
	else if (Ext.Array.contains(this.POSSIBLE_TREE_LEVELS, item.dimName.substring(0, 1)) && item.dimName.length > 1) {
		var tab_idx = item.dimName;
		var parentIndex = (item.dimName.substring(0, 1) === "0") ? 0 : this.lastParentIndex;
		
		if (this.gridsOrFormsLevel_2["gridFields_" + tab_idx]) {// if it was defined, it's a table data
			var row = new Object();
			for (var i = 1; i < (this.gridsOrFormsLevel_2["gridFields_" + tab_idx].length + 1); i++) {
				row["c"+i] = (i < 10) ? item["c0"+i] : item["c"+i];
			}
			
			if (this.gridsOrFormsLevel_2["gridData_" + tab_idx] == undefined)
				this.gridsOrFormsLevel_2["gridData_" + tab_idx] = new Array();
			
			// add a column for the "NextScreen icon"
			var doesCactionExist = false;
			for (var i = 0; i < this.gridsOrFormsLevel_2["gridFields_" + tab_idx].length; i++) {
				if (this.gridsOrFormsLevel_2["gridFields_" + tab_idx][i].name == "caction")
					doesCactionExist = true;
			}
			if (doesCactionExist == false) {
				this.gridsOrFormsLevel_2["gridColumns_" + tab_idx].push( {header: "", dataIndex: "caction", width: 34, align: "center"} );
				this.gridsOrFormsLevel_2["gridFields_" + tab_idx].push( {name: "caction"} );
			}
			
			this.buildNextScreenLink(item, row);// add the data for the "NextScreen icon"
				
			this.gridsOrFormsLevel_2["gridData_" + tab_idx].push({ parentIndex: parentIndex, row: row });
		}
		else {// it's a form data
			if (this.gridsOrFormsLevel_2["formData_" + tab_idx] == undefined)
				this.gridsOrFormsLevel_2["formData_" + tab_idx] = new Array();
			
			var formData = item.c03;
			if (formData === null || formData === undefined || formData === "null" || formData === "undefined")
				formData = "";
			
			var formLabel = item.c02;
			if (formLabel !== null && formLabel !== undefined && formLabel !== "null" && formLabel !== "undefined") {
				if (Ext.String.trim(formLabel).length > 0) {
					this.gridsOrFormsLevel_2["formData_" + tab_idx].push({ parentIndex: parentIndex, label: formLabel, data: formData });
				}
			}
		}
	}
	
	return nextIndex;
}

CBSPublisher.prototype.buildNextScreenLink = function(item, row) {
	var cbs_publisher_instance = this;
	
	if (item.c19 || item.c20) {
		var firstNextScreenIcon = item.c19;
		var secondNextScreenIcon = item.c20;
		
		var addNextScreenIcon = function(nextScreenIconDef) {
			if (nextScreenIconDef == undefined || nextScreenIconDef == null)
				return;
			if (row.caction == undefined || row.caction == null)
				row.caction = "";
			
			var wsParamsArray = null;
			var iconId = null;
			if (nextScreenIconDef.indexOf('|') !== -1) {// there is a context menu
				wsParamsArray = cbs_publisher_instance.getNextScreenParamsFromContextMenuDef(nextScreenIconDef).split(';');
				iconId = cbs_publisher_instance.contextMenuIconId;
				wsParamsArray[0] = "setting-01";// override the WS image name if there is a context menu
			} else {
				wsParamsArray = nextScreenIconDef.split(';');
				iconId = cbs_publisher_instance.nextScreenIconId;
			}
			
			// add WS params that are not in nextScreenIconDef: use '|' to separate the additional params and the ones from WS
			nextScreenIconDef = cbs_publisher_instance.cbsWsSettings.usr + ";" + cbs_publisher_instance.cbsWsSettings.lng + ";" +
					cbs_publisher_instance.cbsWsSettings.roles + ";generalParams|" + nextScreenIconDef;
			// form the final link with parameters
//			row.caction = row.caction + "<img id='" + iconId + "'" +
//			" src='images/studio/icon/mvt.png' title='" + wsParamsArray[1] +
//			"' next_screen_def='" + nextScreenIconDef + "'/>";
			row.caction = row.caction + "<img id='" + iconId + "'" +
				" src='" + cbs_publisher_instance.IMAGES_URL + wsParamsArray[0] + ".png' title='" + wsParamsArray[1] +
				"' next_screen_def='" + nextScreenIconDef + "'/>";
		};
		
		if (firstNextScreenIcon !== undefined)
			addNextScreenIcon(firstNextScreenIcon);
		
		if (secondNextScreenIcon !== undefined)
			addNextScreenIcon(secondNextScreenIcon);
	}
};

CBSPublisher.prototype.getNextScreenParamsFromContextMenuDef = function(nextScreenIconDef) {
	var generalParams = null;
	var nextScreenParams = null;
	
	var menuItemsArray = nextScreenIconDef.split('|');
	for (var i = 0; i < menuItemsArray.length; i++) {
		var wsParamsArray = menuItemsArray[i].split(';');
		if (wsParamsArray[ wsParamsArray.length - 1 ] === "generalParams") {// check if it's not general params added after
			generalParams = menuItemsArray[i];
		} else {
			if (wsParamsArray[4] === undefined || wsParamsArray[4] === "report" || (wsParamsArray[4] !== "callWidget" && wsParamsArray[4] !== "confirmBox")) {
				nextScreenParams = menuItemsArray[i];
				break;
			}	
		}	
	}
	
	if (generalParams !== null)
		return generalParams + '|' + nextScreenParams;
	else
		return nextScreenParams;
}

CBSPublisher.prototype.setReportName = function(name) {
	if (name === null || name === undefined || name === "null" || name === "undefined")
		name = '';
	this.reportName = name;
}

CBSPublisher.prototype.calcCompsInitialSize = function() {
	var initialSize = new Object();
	initialSize.dimensionLinksMaxWidth = (this.maxWidgetWidth / 3 < 200) ? 200 : (this.maxWidgetWidth / 3);
	initialSize.dimensionLinksLabelMaxWidth = (this.dimensionLinks.label) ? this.dimensionLinks.label.length * 8 : initialSize.dimensionLinksMaxWidth / 3;
	initialSize.treeGridMaxHeight = this.maxWidgetHeight * 6 / 10;
	initialSize.firstLevelChartsMaxHeight = this.maxWidgetHeight * 2 / 10;
	initialSize.mainPanelWidth = this.maxWidgetWidth;
    initialSize.mainPanelHeight = this.maxWidgetHeight;
    initialSize.collapsedFormWidth = this.maxWidgetWidth - 20; //minus vertical scrollbar width
    initialSize.chartsPanelWidth = this.maxWidgetWidth * 3.5 / 10 - 27;
	return initialSize;
}

CBSPublisher.prototype.optimizeColumnsSize = function(gridColumns, totalWidth) {
	// first, make the largest column flex=1
	var largestColumn = {index: 0, width: 0};
	for (var i = 0; i < gridColumns.length; i++) {
		if (parseInt(gridColumns[i].widthToCalc) > parseInt(largestColumn.width)) {
			largestColumn.width = gridColumns[i].widthToCalc;
			largestColumn.index = i;
		}
	}
	gridColumns[ largestColumn.index ].flex = 1;
	
	// calculate the sizes (in %) of visible columns using "widthToCalc" values
	var visibleColumnsWidthToCalc = 0;
	var visibleColumnsWidth;
	if(totalWidth == null)
		visibleColumnsWidth = this.mainTreeGridWidth;
	else
		visibleColumnsWidth = totalWidth;
	for (var i = 0; i < gridColumns.length; i++) {
		if (gridColumns[i].hidden !== true) {
			if (gridColumns[i].widthToCalc)
				visibleColumnsWidthToCalc = visibleColumnsWidthToCalc + parseInt( gridColumns[i].widthToCalc );
			else
				visibleColumnsWidth = visibleColumnsWidth - gridColumns[i].width;
		}
	}

	for (var i = 0; i < gridColumns.length; i++) {
		if (gridColumns[i].hidden !== true && gridColumns[i].widthToCalc)
			gridColumns[i].width = visibleColumnsWidth * gridColumns[i].widthToCalc / visibleColumnsWidthToCalc;
	}
	
	return gridColumns;
}

CBSPublisher.prototype.renderReport = function() {
	//console.log(this);
	var cbs_publisher_instance = this;
	var panel_items = new Array();
	var initialSize = this.calcCompsInitialSize();// get the components initial size
	
	// back link
	panel_items.push({
		itemId: this.backLinkId,
		border: false,
		padding: '0 0 5 0',
		html: this.buildBackLinksHTML(),
		anchor: '98.5%',
	});
	
	// main title
	panel_items.push({
		itemId: this.mainTitleId,
		border: false,
		padding: {
			bottom: 10
		},
		anchor: '98.5%',
		html: "<b><p class='label_grid_title'>" + this.reportName + "</p></b></br>"
	});
	
	// zero level - normal form
	if (this.normalFormLevel_0.length > 0) {
		var html = this.getHtmlForNormalForm();
		
		panel_items.push({
			itemId: this.normalFormId,
			border: false,
			anchor: '98.5%',
			padding: '0 0 10 0',
			html: html
		});
		
		panel_items.push({ xtype: "splitter", anchor: '98.5%'});// splitter between the levels
	}
	
	// first level - charts: build
	var charts = this.buildCharts(1, 0);
	
	// zero level - collapsed form
	var collapsedFormPanelItems = new Array();
	if (this.collapsedFormLevel_0.length > 0) {
		var html = this.getHtmlForCollapsedForm();
		
		collapsedFormPanelItems.push({
			itemId: this.collapsedFormId,
			xtype: 'fieldset',
			collapsible: true,
			flex: 1,
			collapsed: false,// initially collapsed or not?
			title: "<b>" + this.collapsedFormLevel_0_title + "</b>",
			html: html,
		});
	}
		
	// add collapsed form & charts to the separate panel that will be added to the main panel items
	panel_items.push({
		itemId: this.collapsedFormPanelId,
		border: false,
		anchor: '98.5%',
		padding: '0 0 10 0',
		layout: {
    	    type: "hbox"
		},
    	items: collapsedFormPanelItems
	});
	
	// first level - dimension links
	if (this.dimensionLinks.length > 0) {
		var dimensionData = new Array();
		for (var i = 0; i < this.dimensionLinks.length; i++) {
			dimensionData.push({ "wsParams": this.dimensionLinks[i].wsParams, "dimTitle": this.dimensionLinks[i].title });
		}
		
		var dimensionDataStore = Ext.create('Ext.data.Store', {
		    fields: ['wsParams', 'dimTitle'],
		    data: dimensionData
		});

		panel_items.push({
			itemId: this.periodDimensionsId,
			labelWidth: initialSize.dimensionLinksLabelMaxWidth,
			xtype: 'combobox',
			anchor: '25%',
			padding: '0 0 10 0',
		    fieldLabel: this.dimensionLinks.label,
		    store: dimensionDataStore,
		    queryMode: 'local',
		    displayField: 'dimTitle',
		    valueField: 'wsParams',
		    listeners: {
		    	select: function(combo, records, eOpts) {
		    		cbs_publisher_instance.cbsWsSettings.newScreen = false;
		    		cbsWidgetPublisher(cbs_publisher_instance.dataWidget, cbs_publisher_instance, records[0].data.wsParams);
		    	} 
		    }
		});
	}
	
	// display error message box
	if (this.error.exists == true) {
		panel_items.push({
			itemId: this.errorMessageId,
			border: false,
			html: this.buildErrorMessageBox()
		});
	}
	
	//Array to store grid tree items and charts
	var gridTreeAndCharts = new Array();
	
	// first level - charts: create a panel
	var chartItems = new Array();
	for (var i = 0; i < charts.length; i++) {
		chartItems.push( charts[i] );
	}
	var chartsPanelDef = null;
	if(this.gridData_level_1.length == 0){
		chartsPanelDef = {
			xtype: 'panel',
			layout:{
				type:'hbox'
			},
			itemId: this.chartsPanelId,
			height: initialSize.treeGridMaxHeight,
			flex: 1,
			items: chartItems,
			margin: '0, 0, 0, 0'
		}
	}
	else{
		chartsPanelDef = {
			xtype: 'tabpanel',
	    	itemId: this.chartsPanelId,
		    height: initialSize.treeGridMaxHeight,
		    flex: 1,
	    	items: chartItems,
	    	plain: true,
	    	activeTab: 0,
	    	tabPosition: 'bottom',
	    	margin: '0, 0, 0, 0'
		};
	}
	
	//Changing the width and height of the tree depending on whether there are charts level 0 or not.
	var mainTreeGridHeight;
	if (charts.length === 0){
		chartsPanelDef.hidden = true;
		this.mainTreeGridWidth = initialSize.mainPanelWidth - 20; //so it doesn't go under the vertical scroll bar
		mainTreeGridHeight = null;
	}
	else{
		this.mainTreeGridWidth = initialSize.mainPanelWidth * 65/100;
		mainTreeGridHeight = initialSize.treeGridMaxHeight;
	}
	// FIRST level - grid or tree
	// 1) rearrange the icon column position: it must always be the second visible column
	if (this.gridColumns[2] !== undefined && this.gridColumns[2].dataIndex === 'rep_icon') {
		var iconCol = this.gridColumns[2];
		this.gridColumns[2] = this.gridColumns[3];
		this.gridColumns[3] = iconCol;
	}
	
	// 2) create and add a grid or tree item
	var mainTreeGridItem = null;
	if (this.isItTree) {
		// prepare the data for the TreeStore and get them as a JSON object
		var store_def_as_json = cbsPublisherTree.getTreeAsJson(this.gridData_level_1);
		var optimizedColumns = this.optimizeColumnsSize(this.gridColumns);
		// Create a Tree component using the prepared data
		mainTreeGridItem = {
			xtype: "treepanel",
			itemId: this.mainTreeId,
			height: mainTreeGridHeight,
			useArrows: true,
			rootVisible: false,
			flex: 2,
	    	columns: optimizedColumns,
		    store: Ext.create("Ext.data.TreeStore", { fields: this.gridFields_level_1, root: store_def_as_json }),
		    listeners: {
		    	itemclick: function(view, record, item, index, e) {
		    		cbs_publisher_instance.gridTreeClickAction(e, record);
		    	}
	    	}
		};
	}
	else {
		var optimizedColumns = this.optimizeColumnsSize(this.gridColumns);
		mainTreeGridItem = {
			xtype: "grid",
			itemId: this.mainGridId,
			flex: 2,
			height: initialSize.treeGridMaxHeight, //added
	    	columns: optimizedColumns,
		    store: Ext.create("Ext.data.Store", { fields: this.gridFields_level_1, data: this.gridData_level_1 }),
	    	listeners: {
		    	itemclick: function(grid, record, item, index, e) {
		    		cbs_publisher_instance.gridTreeClickAction(e, record);
		    	}
	    	}
		};
	}
	
	if (this.gridData_level_1.length === 0 && mainTreeGridItem !== null) {
		mainTreeGridItem.viewConfig = {
	        emptyText: this.NO_DATA_MESSAGE,
	        deferEmptyText: false
	    };
	}
	
	if ( this.doesGridContainDataColumns(this.gridColumns) )// not only system columns
		gridTreeAndCharts.push(mainTreeGridItem);
//		panel_items.push(mainTreeGridItem);
	
	var splitter = Ext.create('Ext.resizer.Splitter', {
		autoShow: true,
		style: {
		    background: '#E7E8E5',
		    cursor: "w-resize"
		},
		width: 4,
		left: 6
	});
	if(charts.length>0)
		gridTreeAndCharts.push(splitter);
	gridTreeAndCharts.push(chartsPanelDef);
	
	panel_items.push({
		itemId: this.gridTreeAndChartsId,
		border: false,
		anchor: '98.5%',
		padding: '0 0 10 0',
		layout: {
    	    type: "hbox"
		},
    	items: gridTreeAndCharts
	});
	
//	panel_items.push(chartsPanelDef);
	
	// main panel
	this.reportPanel = Ext.create('Ext.panel.Panel', {
		itemId: this.mainPanelId,
    	width: initialSize.mainPanelWidth - 20,
	    height: initialSize.mainPanelHeight,
//	    overflowX: "auto",
	    overflowY: "auto",
	    border: false,
    	layout: 'anchor',
    	renderTo: this.wgt_placeholder_id,
//    	bodyStyle:{"background-color":"#fbfbfb"},
	    items: panel_items
	});
	
	var id=null;
	for(var i = 0; i<this.gridData_level_1.length; i++){
		if(this.gridData_level_1[i].caction != null){
			id = this.gridData_level_1[i].row_id;
			i=this.gridData_level_1.length;
		}
	}
	this.renderSecondLevelComps(id, false);
	this.buildSecondLevelTabs("0", 0);// second level - tabs

	closeCbsWaitMessage();
}

CBSPublisher.prototype.doesGridContainDataColumns = function(gridColumns) {
	var dataColumnExists = false;
	for (var i = 0; i < gridColumns.length; i++) {
		if (Ext.Array.contains(this.GRID_SYSTEM_COLUMNS, gridColumns[i].dataIndex) === false) {
			dataColumnExists = true;
			break;
		}
	}
	return dataColumnExists;
}

CBSPublisher.prototype.getHtmlForNormalForm = function() {
	var html = "<table style='font-size:12px; border-spacing: 3 !important;' width='100%'>";// put data in several rows, 3 columns
	for (var i = 0; i < this.normalFormLevel_0.length; i++) {
		var tableRowTmpl = "<td width='15%' class='label_bold'>{0}</td><td width='18.33%' class='label_normal'>{1}</td>";
		
		var tableRow = null;
		if(this.normalFormLevel_0[i].label != null && Ext.String.trim(this.normalFormLevel_0[i].label).length > 0)
			tableRow = Ext.String.format(tableRowTmpl, this.normalFormLevel_0[i].label, this.normalFormLevel_0[i].data);
		else
			tableRow = Ext.String.format(tableRowTmpl, "", "");
		i++;
		if (i < this.normalFormLevel_0.length && this.normalFormLevel_0[i].label != null)
			tableRow += Ext.String.format(tableRowTmpl, this.normalFormLevel_0[i].label, this.normalFormLevel_0[i].data);
		else
			tableRow += Ext.String.format(tableRowTmpl, "", "");
		i++;
		if (i < this.normalFormLevel_0.length && this.normalFormLevel_0[i].label != null)
			tableRow += Ext.String.format(tableRowTmpl, this.normalFormLevel_0[i].label, this.normalFormLevel_0[i].data);
		else
			tableRow += Ext.String.format(tableRowTmpl, "", "");

		if (tableRow !== null)
			html = html + "<tr>" + tableRow + "</tr>";
	}
	html += "</table>";
	return html;
}
	
CBSPublisher.prototype.getHtmlForCollapsedForm = function() {
	var html = "<table style='font-size:12px; border-spacing: 3 !important; border-collapse: separate !important;' width='100%'>";// put data in several rows, 3 columns
	for (var i = 0; i < this.collapsedFormLevel_0.length; i++) {
		var tableRowTmpl = "<td class='label_bold'>{0}</td><td class='label_normal'>{1}</td>";
		
		
		var tableRow = null;
		if(this.collapsedFormLevel_0[i].label != null && Ext.String.trim(this.collapsedFormLevel_0[i].label).length > 0)
			tableRow = Ext.String.format(tableRowTmpl, this.collapsedFormLevel_0[i].label, this.collapsedFormLevel_0[i].data);
		else
			tableRow = Ext.String.format(tableRowTmpl, "", "");
		i++;
		
		if (i < this.collapsedFormLevel_0.length && this.collapsedFormLevel_0[i].label != null)
			tableRow += Ext.String.format(tableRowTmpl, this.collapsedFormLevel_0[i].label, this.collapsedFormLevel_0[i].data);
		else
			tableRow += Ext.String.format(tableRowTmpl, "", "");
		i++;
		
		if (i < this.collapsedFormLevel_0.length && this.collapsedFormLevel_0[i].label != null)
			tableRow += Ext.String.format(tableRowTmpl, this.collapsedFormLevel_0[i].label, this.collapsedFormLevel_0[i].data);
		else
			tableRow += Ext.String.format(tableRowTmpl, "", "");
		i++;
		
		if (i < this.collapsedFormLevel_0.length && this.collapsedFormLevel_0[i].label != null)
			tableRow += Ext.String.format(tableRowTmpl, this.collapsedFormLevel_0[i].label, this.collapsedFormLevel_0[i].data);
		else
			tableRow += Ext.String.format(tableRowTmpl, "", "");
		i++;
		
		if (i < this.collapsedFormLevel_0.length && this.collapsedFormLevel_0[i].label != null)
			tableRow += Ext.String.format(tableRowTmpl, this.collapsedFormLevel_0[i].label, this.collapsedFormLevel_0[i].data);
		else
			tableRow += Ext.String.format(tableRowTmpl, "", "");
		i++;
		
		if (i < this.collapsedFormLevel_0.length && this.collapsedFormLevel_0[i].label != null)
			tableRow += Ext.String.format(tableRowTmpl, this.collapsedFormLevel_0[i].label, this.collapsedFormLevel_0[i].data);
		else
			tableRow += Ext.String.format(tableRowTmpl, "", "");
		
//		var tableRow = null;
//		if(this.collapsedFormLevel_0[i].label != null)
//			tableRow = Ext.String.format(tableRowTmpl, this.collapsedFormLevel_0[i].label, this.collapsedFormLevel_0[i].data);
//		if ((i + 1) < this.collapsedFormLevel_0.length && this.collapsedFormLevel_0[i+1].label != null)
//			tableRow += Ext.String.format(tableRowTmpl, this.collapsedFormLevel_0[++i].label, this.collapsedFormLevel_0[i].data);
//		if ((i + 1) < this.collapsedFormLevel_0.length && this.collapsedFormLevel_0[i+1].label != null)
//			tableRow += Ext.String.format(tableRowTmpl, this.collapsedFormLevel_0[++i].label, this.collapsedFormLevel_0[i].data);
//		if ((i + 1) < this.collapsedFormLevel_0.length && this.collapsedFormLevel_0[i+1].label != null)
//			tableRow += Ext.String.format(tableRowTmpl, this.collapsedFormLevel_0[++i].label, this.collapsedFormLevel_0[i].data);
//		if ((i + 1) < this.collapsedFormLevel_0.length && this.collapsedFormLevel_0[i+1].label != null)
//			tableRow += Ext.String.format(tableRowTmpl, this.collapsedFormLevel_0[++i].label, this.collapsedFormLevel_0[i].data);
//		if ((i + 1) < this.collapsedFormLevel_0.length && this.collapsedFormLevel_0[i+1].label != null)
//			tableRow += Ext.String.format(tableRowTmpl, this.collapsedFormLevel_0[++i].label, this.collapsedFormLevel_0[i].data);
//		i++;
			
		if (tableRow !== null)
			html = html + "<tr>" + tableRow + "</tr>";
	}
	html += "</table>";
	return html;
}

CBSPublisher.prototype.gridTreeClickAction = function(event, record) {
	if (event.target.id === this.nextScreenIconId) {
		var nextScreenData = this.prepareNextScreenData(event, event.target.title);
		cbsWidgetPublisherNextScreen(nextScreenData.nextScreenIconDef, nextScreenData.prevPlaceholderInfo, this.dataWidget.getName());
	}
	else if (event.target.id === this.contextMenuIconId) {
		var nextScreenData = this.prepareNextScreenData(event, event.target.title);
		this.showTreeGridContextMenu(nextScreenData.nextScreenIconDef, nextScreenData.prevPlaceholderInfo, event);
	}
	else if (event.target.id === this.searchDetailsIconId) {
		/*if the second tab is not already there, then call the function again.
		because there is a bug where the loop needs to be clicked twice for the data to appear the first time*/
		if(this.reportPanel.getComponent(this.secondLevelTabsId) == null)
			this.renderSecondLevelComps( record.get('row_id'), true );
		
		this.renderSecondLevelComps( record.get('row_id'), false );// second level - tabs
	}
}

CBSPublisher.prototype.prepareNextScreenData = function(event, iconTitle) {
	var nextScreenIconDef = $(event.target).attr('next_screen_def');
	
	var prevPlaceholderInfo = new Object();
	prevPlaceholderInfo.IDs = new Array();
	prevPlaceholderInfo.repTitles = new Array();
	
	// add previous placeholder_info
	$.extend(prevPlaceholderInfo.IDs, this.prev_wgt_placeholder_info.IDs);
	$.extend(prevPlaceholderInfo.repTitles, this.prev_wgt_placeholder_info.repTitles);
	
	// add current placeholder_info
	prevPlaceholderInfo.IDs.push(this.wgt_placeholder_id);
	if (prevPlaceholderInfo.IDs.length === 1)
		prevPlaceholderInfo.repTitles.push(this.reportName);

	// add future placeholder_info
	prevPlaceholderInfo.repTitles.push(iconTitle);
	
	return {nextScreenIconDef: nextScreenIconDef, prevPlaceholderInfo: prevPlaceholderInfo};
}

CBSPublisher.prototype.showTreeGridContextMenu = function(nextScreenIconDef, prevPlaceholderInfo, event) {
	var cbs_publisher_instance = this;
	
    event.stopEvent();
    var items = new Array();
    
    // build report (next screen) menu item
    items.push({
    	text: 'Report',
    	handler: function() {
    		var nextScreenParams = cbs_publisher_instance.getNextScreenParamsFromContextMenuDef(nextScreenIconDef);
    		cbsWidgetPublisherNextScreen(nextScreenParams, prevPlaceholderInfo, cbs_publisher_instance.dataWidget.getName());
    	}
    });
    
    // build widget call menu item
    var buildWidgetCallItem = function(dqMenuParams) {
    	return {
    		text: dqMenuParams.title,
	    	handler: function() {
	    		var eventParams = new Array();
	    		eventParams.push( dqMenuParams.widgetToCall );
	    		
	    		dfSetContextValue(cbs_publisher_instance.CONTEXT_VALUE_WGT_CALL.object_name, cbs_publisher_instance.CONTEXT_VALUE_WGT_CALL.object_value, dqMenuParams.rowId, function() {
	    			cbs_publisher_instance.dataWidget.publishEvent(cbs_publisher_instance.GENERATE_WIDGET_EVENT, eventParams);
	    			console.log("===> Redirection");
	    			console.log("app context " + cbs_publisher_instance.CONTEXT_VALUE_WGT_CALL.object_name + "." +
	    				cbs_publisher_instance.CONTEXT_VALUE_WGT_CALL.object_value + ": " +
	    				appcontext[cbs_publisher_instance.CONTEXT_VALUE_WGT_CALL.object_name][cbs_publisher_instance.CONTEXT_VALUE_WGT_CALL.object_value]);
	    			console.log("event name: " + cbs_publisher_instance.GENERATE_WIDGET_EVENT + ", event params:");
	    			console.log(eventParams);
	    		});
	    	}
	    }
    };
    
    // build Data Query call menu item
    var buildDataQueryCallItem = function(dqMenuParams) {
    	return {
    		text: dqMenuParams.title,
	    	handler: function() {
	    		Ext.Msg.show({
	    		     title: dqMenuParams.windowTitle,
	    		     msg: dqMenuParams.confirmMessage,
	    		     buttonText: {yes: dqMenuParams.confirmButtonTitle, no: 'NO'},
	    		     icon: Ext.Msg.QUESTION,
	    		     fn: function(buttonId, text, opt) {
	    		    	 if (buttonId === 'yes') {
	    		    		 var dataQuerySettings = new Object();
	    		    		 dataQuerySettings.usr = cbs_publisher_instance.cbsWsSettings.usr;
	    		    		 dataQuerySettings.lng = cbs_publisher_instance.cbsWsSettings.lng;
	    		    		 dataQuerySettings.cmd = dqMenuParams.cmd;
	    		    		 
	    		    		 //Code added by Jad. Apparently it works without this 
//	    		    		 dataQuerySettings.id = dqMenuParams.id;
//	    		    		 dataQuerySettings.fromNumber = dqMenuParams.fromNumber;
//	    		    		 dataQuerySettings.toNumber = dqMenuParams.toNumber;
	    		    		 
	    		    		 cbs_publisher_instance.executeDataQueryContextMenuItem(dqMenuParams.dataQueryName, dataQuerySettings);
	    		    	 }
	    		     }
	    		});
	    	}
    	}
    };
    
    // parsing params to build widget call and data query menu items
    var menuItemsArray = nextScreenIconDef.split('|');
	for (var i = 0; i < menuItemsArray.length; i++) {
		var wsParamsArray = menuItemsArray[i].split(';');
		if (wsParamsArray[4] === "callWidget") {
			//null;destroy partiel;wDemchqDestroyCirculation;id,AAAgvAAAFAAI3scAAF;callWidget
			var dqMenuParams = new Object();
			dqMenuParams.title = wsParamsArray[1];
			dqMenuParams.widgetToCall = wsParamsArray[2];
			dqMenuParams.rowId = wsParamsArray[3].split(',')[1];
			
			items.push( buildWidgetCallItem(dqMenuParams) );
		} else if (wsParamsArray[4] === "confirmBox") {
			//null;destroy checkbook in stock;Destroy checkbook;YES;confirmBox;Are you sure to destroy checkbook?;qDemChqUiCmd;destroy,id,AAAgvAAAFAAI3ZGAAJ,fromNumber,137680,toNumber,137682
			var dqMenuParams = new Object();
			dqMenuParams.title = wsParamsArray[1];
			dqMenuParams.windowTitle = wsParamsArray[2];
			dqMenuParams.confirmButtonTitle = wsParamsArray[3];
			dqMenuParams.confirmMessage = wsParamsArray[5];
			dqMenuParams.dataQueryName = wsParamsArray[6];
			dqMenuParams.cmd = wsParamsArray[7];
			console.log("complete: " + wsParamsArray[7].split(','));
			//Code added by Jad. Apparently it works without this
//			var params = wsParamsArray[7].split(',');
//			dqMenuParams.cmd = params[0];
//			dqMenuParams.id = params[2];
//			dqMenuParams.fromNumber = params[4];
//			dqMenuParams.toNumber = params[6];
			
			items.push( buildDataQueryCallItem(dqMenuParams) );
		}
	}
    
    var menu = new Ext.menu.Menu({
    	plain: true,
    	items: items
	}).showAt(event.xy);
};

CBSPublisher.prototype.executeDataQueryContextMenuItem = function(dataQueryName, dataQuerySettings) {
	var cbs_publisher_instance = this;
	
	var dq = new DataQuery(dataQueryName);
	dq.setParameters(dataQuerySettings);
	dq.execute(null, function(dataSet) {
		var buffer = dataSet.getData();
		
		if (buffer) {
			var answerAck = ( buffer[0] ) ? buffer[0].data[0].answerAck : buffer.data[0].answerAck;
			console.log("answerAck: " + answerAck);
			if (answerAck === "ok") {
				cbs_publisher_instance.cbsWsSettings.newScreen = false;
				//TODO: for the future - add param to know that ONLY tree/grid must be refreshed,
				//      that means, do NOT call the refreshReport() function in the chain but another one,
				//      which does nothing except reloading the tree/grid
				cbsWidgetPublisher(cbs_publisher_instance.dataWidget, cbs_publisher_instance, cbs_publisher_instance.cbsWsSettings);
			}
		}
	});
};

CBSPublisher.prototype.refreshReport = function() {
	// remove tabs
	this.reportPanel.remove( this.reportPanel.getComponent(this.secondLevelTabsId) );
	
	// treat error message
	if (this.error.exists == true) {
		var errorMessageBox = this.reportPanel.getComponent(this.errorMessageId);
		if (errorMessageBox !== undefined) {
			errorMessageBox.update( this.buildErrorMessageBox() );
		} else {
			this.reportPanel.add({
				itemId: this.errorMessageId,
				border: false,
				html: this.buildErrorMessageBox()
			});
		}
		
		// hide all other components except title, dimension links and error message
		for (var i = 0; i < this.reportPanel.items.length; i++) {
			var comp = this.reportPanel.items.getAt(i);
			var compItemId = comp.getItemId();
			if (compItemId !== this.mainTitleId && compItemId !== this.backLinkId && compItemId !== this.periodDimensionsId && compItemId !== this.errorMessageId) {
				comp.hide();
			}
			else if (compItemId === this.mainTitleId || compItemId !== this.backLinkId || compItemId === this.periodDimensionsId || compItemId === this.errorMessageId) {
				comp.show();
			}
		}
	} else {
		// show all components except the error message
		for (var i = 0; i < this.reportPanel.items.length; i++) {
			var comp = this.reportPanel.items.getAt(i);
			var compItemId = comp.getItemId();
			if (compItemId === this.errorMessageId) {
				comp.hide();
			} else {
				comp.show();
			}
		}
	
		// UPDATE THE COMPONENTS WITH NEW CONTENT:
		// zero level - normal form
		if (this.normalFormLevel_0.length > 0) {
			var html = this.getHtmlForNormalForm();
			var normalForm = this.reportPanel.getComponent(this.normalFormId);
			normalForm.update(html);
		}
		
		// first level - charts: build
		var collapsedFormPanel = this.reportPanel.getComponent(this.collapsedFormPanelId);
		var charts = this.buildCharts(1, 0);
		
		// zero level - collapsed form
		var collapsedFormPanelItems = new Array();
		if (this.collapsedFormLevel_0.length > 0) {
			var html = this.getHtmlForCollapsedForm();
			
			if (collapsedFormPanel) {
				var collapsedForm = this.reportPanel.getComponent(this.collapsedFormPanelId).getComponent(this.collapsedFormId);
				collapsedForm.update(html);
			}
		}
		
		// first level - charts
		var chartItems = new Array();
		for (var i = 0; i < charts.length; i++) {
			chartItems.push( charts[i] );
		}
		if (collapsedFormPanel) {
			var chartsContainer = this.reportPanel.getComponent(this.gridTreeAndChartsId).getComponent(this.chartsPanelId);
			if (chartsContainer) {
				chartsContainer.removeAll();
				chartsContainer.add(chartItems);
				if (charts.length === 0)
					chartsContainer.setVisible(false);
			}
		}
		
		// reload the tree or grid with new data
		if (this.isItTree) {
			var mainTree = this.reportPanel.getComponent(this.gridTreeAndChartsId).getComponent(this.mainTreeId);
			if (mainTree) {
				var store_def_as_json = cbsPublisherTree.getTreeAsJson(this.gridData_level_1);
				mainTree.setRootNode(store_def_as_json);
			}
		} else {
			var mainGrid = this.reportPanel.getComponent(this.gridTreeAndChartsId).getComponent(this.mainGridId);
			if (mainGrid) {
				var newStore = Ext.create("Ext.data.Store", { fields: this.gridFields_level_1, data: this.gridData_level_1 });
				mainGrid.reconfigure(newStore);
			}
		}
		
		this.buildSecondLevelTabs("0", 0);// second level - tabs
	}
	
	var id=null;
	for(var i = 0; i<this.gridData_level_1.length; i++){
		if(this.gridData_level_1[i].caction != null){
			id = this.gridData_level_1[i].row_id;
			i=this.gridData_level_1.length;
		}
	}
	this.renderSecondLevelComps(id, false);
	
	closeCbsWaitMessage();
}

/*
 * Create Tab with second level nested grids. Must be invoked by clicking on the row in the first level grid.
 */
CBSPublisher.prototype.renderSecondLevelComps = function(parentIndex, onlyTabs) {
	// build tabs of the second level
	for (var i = 0; i < this.POSSIBLE_TREE_LEVELS.length; i++) {
		if (this.POSSIBLE_TREE_LEVELS[i] !== "0" && this.buildSecondLevelTabs(this.POSSIBLE_TREE_LEVELS[i], parentIndex))
			break;
	}
	
	// build charts of the second level
	if(onlyTabs != true)
		this.buildSecondLevelCharts(2, parentIndex);
	
	
	// scroll to selected row in the first level grid
	var mainTreeGrid = (this.isItTree) ? this.reportPanel.getComponent(this.gridTreeAndChartsId).getComponent(this.mainTreeId) : 
		this.reportPanel.getComponent(this.gridTreeAndChartsId).getComponent(this.mainGridId);
	if (mainTreeGrid) {
		var lastSelectedRow = mainTreeGrid.getSelectionModel().getLastSelected();
		if (lastSelectedRow) {
			var lastSelectedIndex = lastSelectedRow.index;
			mainTreeGrid.getView().focusRow(lastSelectedIndex);
		}
	}
}

CBSPublisher.prototype.buildSecondLevelTabs = function(treeIndex, parentIndex) {
	var cbs_publisher_instance = this;
	var tabIndex = 0;
	var tabIdPrefix = "cbsSecondLevelTabIdPrefix_" + this.wgt_placeholder_id;
	
	if (this.gridsOrFormsLevel_2["reportName_" + treeIndex + tabIndex]) {
		var parseContinue = true;
		var items = new Array();
		
		// tabs: grids & forms
		while (parseContinue) {
			if (this.gridsOrFormsLevel_2["reportName_" + treeIndex + tabIndex]) {
				if (this.gridsOrFormsLevel_2["gridColumns_" + treeIndex + tabIndex]) {// if it was defined, it's a table data
					var gridData = new Array();
					var currTabAllData = this.gridsOrFormsLevel_2["gridData_" + treeIndex + tabIndex];
					if (currTabAllData !== undefined) {
						for (var i = 0; i < currTabAllData.length + 1; i++) {
							if (currTabAllData[i] && (currTabAllData[i].parentIndex == parentIndex))
								gridData.push( currTabAllData[i].row );
						}
					}
					
					var item = {
						title: this.gridsOrFormsLevel_2["reportName_" + treeIndex + tabIndex],
						itemId: tabIdPrefix + '_' + treeIndex + tabIndex,
						forceFit: true,
	        			xtype: "grid",
	        			columns: this.gridsOrFormsLevel_2["gridColumns_" + treeIndex + tabIndex],
	        			store: Ext.create("Ext.data.Store", { fields: this.gridsOrFormsLevel_2["gridFields_" + treeIndex + tabIndex], data: gridData }),
	        			listeners: {
	        		    	itemclick: function(grid, record, item, index, e) {
	        		    		cbs_publisher_instance.gridTreeClickAction(e, record);
	        		    	}
	        	    	}
		    		};
					if (gridData.length === 0) {
						item.viewConfig = {
							emptyText: this.NO_DATA_MESSAGE,
					        deferEmptyText: false
						};
					}
					if ( this.doesGridContainDataColumns(this.gridsOrFormsLevel_2["gridColumns_" + treeIndex + tabIndex]) )// not only system columns
						items.push(item);
				}
				else {// it's a form data
					var html = "<table style='font-size:12px;' width='100%'>";// put data in several rows, 3 columns
					var currTabAllData = this.gridsOrFormsLevel_2["formData_" + treeIndex + tabIndex];
					if (currTabAllData) {
						var tableRowTmpl = "<td width='15%' class='label_bold'>{0}</td><td class='label_normal' width='18.33%'>{1}</td>";
												
						for (var i = 0; i < currTabAllData.length; i++) {
							if (currTabAllData[i] && (currTabAllData[i].parentIndex == parentIndex)) {
								
								var tableRow = null;
								if(currTabAllData[i].label != null && Ext.String.trim(currTabAllData[i].label).length > 0)
									tableRow = Ext.String.format(tableRowTmpl, currTabAllData[i].label, currTabAllData[i].data);
								else
									tableRow = Ext.String.format(tableRowTmpl, "", "");
								i++;
								
								if (i < currTabAllData.length && currTabAllData[i].label != null)
									tableRow += Ext.String.format(tableRowTmpl, currTabAllData[i].label, currTabAllData[i].data);
								else
									tableRow += Ext.String.format(tableRowTmpl, "", "");
								i++;
								
								if (i < currTabAllData.length && currTabAllData[i].label != null)
									tableRow += Ext.String.format(tableRowTmpl, currTabAllData[i].label, currTabAllData[i].data);
								else
									tableRow += Ext.String.format(tableRowTmpl, "", "");
//								var tableRow = null;
//								tableRow = Ext.String.format(tableRowTmpl, currTabAllData[i].label, currTabAllData[i].data);
//								if ((i + 1) < currTabAllData.length)
//									tableRow += Ext.String.format(tableRowTmpl, currTabAllData[++i].label, currTabAllData[i].data);
//								if ((i + 1) < currTabAllData.length)
//									tableRow += Ext.String.format(tableRowTmpl, currTabAllData[++i].label, currTabAllData[i].data);
									
								if (tableRow !== null)
									html = html + "<tr>" + tableRow + "</tr>";
							}
						}
					}
					html += "</table>";
					
					if (! currTabAllData)
						html = this.NO_DATA_MESSAGE;
					
					var item = {
						title: this.gridsOrFormsLevel_2["reportName_" + treeIndex + tabIndex],
						itemId: tabIdPrefix + '_' + treeIndex + tabIndex,
						padding: 10,
						html: html
		    		};
					items.push(item);
				}
			}
			else
				parseContinue = false;
			
			tabIndex++;
		}
		
		// remove previous tabs if exists
		var prevTabContainer = this.reportPanel.getComponent(this.secondLevelTabsId);
		if (prevTabContainer) {
			var firstLevelTabsExist = false;
			for (var treeIdx = 0; treeIdx < this.POSSIBLE_TREE_LEVELS.length; treeIdx++) {
				if (this.POSSIBLE_TREE_LEVELS[treeIdx] !== '0') {// remove second level tabs
					for (var tabIdx = 0; tabIdx < 8; tabIdx++) {
						var oldTab = prevTabContainer.getComponent(tabIdPrefix + '_' + this.POSSIBLE_TREE_LEVELS[treeIdx] + tabIdx);
						if (oldTab)
							prevTabContainer.remove(oldTab);
					}
				}
				else
					firstLevelTabsExist = true;
			}
				
			if (firstLevelTabsExist === false)// remove the whole container if there are no first level tabs
				this.reportPanel.remove(prevTab);
		}
		
		// add new tabs
		if (items.length > 0) {
			var currentTabContainer = this.reportPanel.getComponent(this.secondLevelTabsId);
			if (currentTabContainer) {// there are first level tabs
				for (var i = 0; i < items.length; i++) {
					currentTabContainer.add(items[i]);
				}
				currentTabContainer.setActiveTab( currentTabContainer.getComponent(items[0].itemId) );
			}
			else {// there are no first level tabs, not even container
				var newTabContainer = Ext.create('Ext.tab.Panel', {
					itemId: this.secondLevelTabsId,
//					width: this.maxWidgetWidth - 20, //added
//					maxWidth: this.maxWidgetWidth - 20, //minus vertical scrollbar
					anchor: '98.5%',
					plain: true,
					items: items
				});
				this.reportPanel.add(newTabContainer);
			}
			
			return true;
		}
		else
			return false;
	}
}

CBSPublisher.prototype.buildSecondLevelCharts = function(levelIndex, parentIndex) {
	var chartIdPrefix = "cbsSecondLevelChartIdPrefix_" + this.wgt_placeholder_id;
	
	var charts = this.buildCharts(levelIndex, parentIndex);
	if (charts.length > 0) {
		var chartsContainer = this.reportPanel.getComponent(this.gridTreeAndChartsId).getComponent(this.chartsPanelId);
		var mainTreeGrid = (this.isItTree) ? this.reportPanel.getComponent(this.gridTreeAndChartsId).getComponent(this.mainTreeId) : 
			this.reportPanel.getComponent(this.gridTreeAndChartsId).getComponent(this.mainGridId);
		
		// first, remove the old second level charts
		var chartsNumber = chartsContainer.items.length;
		for (var i = 0; i < chartsNumber; i++) {
			var oldChart = chartsContainer.getComponent(chartIdPrefix + '_' + i);
			if (oldChart)
				chartsContainer.remove(oldChart);
		}
		
		// and now, add new second level charts
		for (var i = 0; i < charts.length; i++) {
			var chartLevel_2 = charts[i];
			chartLevel_2.itemId = chartIdPrefix + '_' + i;
			chartsContainer.add(chartLevel_2);
			chartsContainer.setActiveTab( chartsContainer.getComponent(chartLevel_2.itemId) );
		}
		
		if (chartsContainer.isHidden()) {
//			mainTreeGrid.setWidth(this.maxWidgetWidth * 6.5/10);
//			mainTreeGrid.setHeight(this.maxWidgetHeight * 6/10);
			chartsContainer.setVisible(true);
		}
	}
}

CBSPublisher.prototype.buildCharts = function(levelIndex, parentIndex) {
	var currentLevelChartsDef = this["chartsLevel_" + levelIndex]["chart_" + parentIndex];
	var charts = new Array();
	
	if (currentLevelChartsDef) {
		// enumerate current level charts definitions
		var indexWithinLevel = 0;
		for (var propName in currentLevelChartsDef) {
			if ( currentLevelChartsDef.hasOwnProperty(propName) ) {
				var chartDef = currentLevelChartsDef[propName];
				chartDef.itemId = this.createChartId(levelIndex, indexWithinLevel++);
				
				// build the chart component
				if ( chartDef.pie ) {// pie chart
					var pieChart = this.buildPieChart(chartDef);
					charts.push(pieChart);
				}
				else if ( chartDef.line ) {//line chart
					var lineChart = this.buildLineChart(chartDef);
					if (lineChart !== null)
						charts.push(lineChart);
				}
				else if ( chartDef.bar ) {//bar chart
					var barChart = this.buildBarChart(chartDef);
					if (barChart !== null)
						charts.push(barChart);
				}
			}
		}
	}
	
	return charts;
}

CBSPublisher.prototype.createChartId = function(levelIndex, indexWithinLevel) {
	return 'cbsChart_' + this.wgt_placeholder_id + levelIndex + '_' + indexWithinLevel;
}

CBSPublisher.prototype.buildPieChart = function(chartDef) {
	var cbs_publisher_instance = this;
	var initialSize = this.calcCompsInitialSize();// get the components initial size
	var data = new Array(), yFields = new Array();
	for (var i = 0; i < chartDef.series.length; i++) {
		data.push({ 'name': chartDef.series[i].c02, 'data': parseFloat(chartDef.series[i].c03) });
		yFields.push(chartDef.series[i].c02);
	}
	
	var store = Ext.create('Ext.data.JsonStore', {
	    fields: ['name', 'data'],
	    data: data
	});
	
	var pieChart = {
		itemId: chartDef.itemId,
		title: chartDef.series[0].c01,
		legend: { position: 'right' },
		xtype: 'chart',
		height: initialSize.treeGridMaxHeight,
		flex: 1,
		animate: true,
	    store: store,
	    shadow: true,
	    series: [{
	    	type: 'pie', angleField: 'data', showInLegend: true, xField: 'name', yField: yFields, title: yFields,
	        tips: {
	            trackMouse: true,  width: 200, height: 35,
	            renderer: function(storeItem) {// calculate and display percentage on hover
	                this.setTitle(storeItem.get('name') + ': ' + Ext.util.Format.number(storeItem.get('data'), '0,0.00'));
	            }
	        },
	        theme: 'Base:gradients',
		    shadow: true,
	        highlight: { segment: {margin: 20 } },
	        label    : {
	        	field: 'data', display: 'rotate', contrast: true,
	        	font: "12px 'Lucida Grande', 'Lucida Sans Unicode', Verdana, Arial, Helvetica, sans-serif",
	        	renderer: function(storeItem) {// calculate percentage
	        		var total = 0;
	                store.each(function(rec) { total += rec.get('data'); });
	                if(storeItem == 0)
	                	return "";
	                else if (total !== 0)
	                	return Math.round(storeItem / total * 100) + '%';
	                else
	                	return Math.round(storeItem) + '%';
	            }
	        }
	    }]
	};
	
	var showChartInPopup = function() {
		cbs_publisher_instance.openChartInPopup(pieChart);
	};
	
	pieChart.listeners = {
    	click: showChartInPopup
    };
	
	return pieChart;
}

//analyzing the data of the line chart to see the format in which the data is arriving.
CBSPublisher.prototype.getLineChartData = function(chartDef){
	var following = false, firstElement = chartDef.series[0].c02, count = 1;
	if (firstElement == chartDef.series[1].c02)
		following = true;
	for(var i = 1; i < chartDef.series.length; i++){
		if(following == true){
			if(chartDef.series[i].c02 == firstElement){
				count++;
			}
			else{
				i = chartDef.series[i].length;
			}
		}
		else if(following == false){
			if(chartDef.series[i].c02 != firstElement){
				count++;
			}
			else{
				i=chartDef.series[i].length;
			}
		}
	}
	
	var result = new Object();
	result.following = following;
	result.count = count;
	return result;
}

CBSPublisher.prototype.buildLineChart = function(chartDef) {
	var cbs_publisher_instance = this;
	var initialSize = this.calcCompsInitialSize();// get the components initial size
	var fields = new Array();
	var fieldsVertAxe = new Array();
	var data = new Array();
	var axes = new Array();
	var series = new Array();
	
	fields.push('name');
		
	if(chartDef.series){
		result = cbs_publisher_instance.getLineChartData(chartDef);
		count = result.count, following = result.following;
		var index;
		for(var j = 0; j<count; j++){
			if(following == true){
				index = j*count;
			}
			else if (following == false){
				index = j;
			}
			
			if(index < chartDef.series.length){
				series.push({ type: 'line', axis: 'left', xField: 'name', yField: chartDef.series[index].c02, 
					highlight: {size: 3, radius: 3}, markerConfig: {type: 'cross', size: 4, radius: 4, 'stroke-width': 0}, 
					tips: {trackMouse: true, width:140, height: 40, renderer: function(storeItem, item){
						this.setTitle(storeItem.get('name') + ": " + Ext.util.Format.number(item.value[1], '0,0.00'));}} });
				fields.push(chartDef.series[index].c02);
				fieldsVertAxe.push(chartDef.series[index].c02);
			}
			else{
				j = count;
			}
		}
	}
	
	
	if (chartDef.series) {
		for (var i = 0; i < chartDef.series.length; i++) {
//			if ($.inArray(chartDef.series[i].c02, fields) === -1) {
//				fields.push( chartDef.series[i].c02 );
//				fieldsVertAxe.push( chartDef.series[i].c02 );
//				
//				series.push({ type: 'line', axis: 'left', xField: 'name', yField: chartDef.series[i].c02, 
//					highlight: {size: 3, radius: 3}, markerConfig: {type: 'cross', size: 4, radius: 4, 'stroke-width': 0}, 
//					tips: {trackMouse: true, width:140, height: 40, renderer: function(storeItem, item){
//						this.setTitle(Ext.Date.format(new Date(storeItem.get('name')), 'd-M-Y') + ": " + Ext.util.Format.number(item.value[1], '0,0.00'));}} });
//			}
			if(following == true){
				if(i >= count){
					data[i%count][chartDef.series[i].c02] = parseFloat( chartDef.series[i].c03 );
				}
				else{
					var dataItem = new Object();
//					if (chartDef.graphType === 'date'){
//						var tempDate = new Date(chartDef.series[i].c01.replace( /(\d{2}).(\d{2}).(\d{4})/, "$2/$1/$3")).getTime();
//						dataItem.name = Ext.Date.format(new Date (tempDate), 'd-M-Y');	
//					}	
//					else if (chartDef.graphType === 'number')
//						dataItem.name = parseFloat(chartDef.series[i].c01);
					dataItem.name = chartDef.series[i].c01;
					dataItem[ chartDef.series[i].c02 ] = parseFloat( chartDef.series[i].c03 );
					data.push(dataItem);
				}
			}
			else if (following == false){
				var dataItem = new Object();
//				if (chartDef.graphType === 'date'){
//					var tempDate = new Date(chartDef.series[i].c01.replace( /(\d{2}).(\d{2}).(\d{4})/, "$2/$1/$3")).getTime();
//					dataItem.name = Ext.Date.format(new Date (tempDate), 'd-M-Y');	
//				}	
//				else if (chartDef.graphType === 'number')
//					dataItem.name = parseFloat(chartDef.series[i].c01);
				dataItem.name = chartDef.series[i].c01;
				for(var k = i; k<count + i; k++){
					dataItem[ chartDef.series[k].c02 ] = parseFloat( chartDef.series[k].c03 );
				}
				data.push(dataItem);
				i = i+count-1;
			}
		}
		
		axes.push({ type: 'Numeric', position: 'left', fields: fieldsVertAxe, label: {renderer: Ext.util.Format.numberRenderer('0,0.00'), font: '10px Arial'}, grid: true, hidden: false });
//		if (chartDef.graphType === 'date')
			axes.push({ type: 'Category', position: 'bottom', fields: ['name'], grid: false, hidden: false, label: {font: '10px Arial', rotate:{degrees:340}} });
//		else if (chartDef.graphType === 'number')
//			axes.push({ type: 'Number', position: 'bottom', fields: ['name'], grid: true, hidden: false, label: {font: '10px Arial', rotate:{degrees:340}} });
		
		var store = Ext.create('Ext.data.JsonStore', {
			fields: fields,
		    data: data
		});
		
		var lineChart = {
			itemId: chartDef.itemId,
			xtype: 'chart',
			title: chartDef.label,
			legend: { position: 'right' },
			style: 'background:#fff',
			height: initialSize.treeGridMaxHeight,
			flex: 1,
		    animate: true,
		    store: store,
		    axes: axes,
		    series: series		    
		};
		
		var showChartInPopup = function() {
			cbs_publisher_instance.openChartInPopup(lineChart);
		};
		
		lineChart.listeners = {
	    	click: showChartInPopup
	    };
		
		return lineChart;
	}
	else {
		return null;
	}
}

CBSPublisher.prototype.buildBarChart = function(chartDef) {
	var cbs_publisher_instance = this;
	var initialSize = this.calcCompsInitialSize();// get the components initial size
	
	//This for loop is to find how many data sets the chart has.
	var count=1;
	var dataName = chartDef.series[0].c02, fields = ['name', dataName];; 
	for (var i = 1; i<chartDef.series.length-1; i++){
		if(dataName === chartDef.series[i].c02){
			i=chartDef.series.length-1;}
		else{
			fields.push(chartDef.series[i].c02)
			count++;}
	}
	
	var xFields = fields.slice(0, 1);
	var yFields = fields.slice(1, fields.length);
	var legend = new Object();
	if(yFields.length>1)
		legend = {position: 'right'};
	else
		legend = null;
	
	var data = new Array();
	for (var i = 0; i < chartDef.series.length; i++) {
		if(i%count == 0)
			var dataItem = new Object();
		dataItem['name'] = chartDef.series[i].c01;
		dataItem[chartDef.series[i].c02] = parseFloat(chartDef.series[i].c03);
		if(i%count == (count - 1))
			data.push(dataItem);
	}
	
	var series = null;
	if(chartDef.series.length <=3){
		series = [{
	        type: 'bar',
	        axis: 'bottom',
	        highlight: true,
	        column: true,
	        tips: {
	        	trackMouse: true,
	        	width: 140,
	        	height: 48,
	        	renderer: function(storeItem, item) {
	        		this.setTitle(storeItem.get('name') + ': ' + Ext.util.Format.number(item.value[1], '0,0.00'));
	        	}
	        },
	        style: {
	        	width: 80
	        },
	        xField: xFields,
	        yField: yFields
	    }];
	}
	else{
		series = [{
	        type: 'bar',
	        axis: 'bottom',
	        highlight: true,
	        column: true,
	        tips: {
	        	trackMouse: true,
	        	width: 140,
	        	height: 48,
	        	renderer: function(storeItem, item) {
	        		this.setTitle(storeItem.get('name') + ': ' + Ext.util.Format.number(item.value[1], '0,0.00'));
	        	}
	        },
	        xField: xFields,
	        yField: yFields
	    }];
	}
	
	var store = Ext.create('Ext.data.JsonStore', {
	    fields: fields,
	    data: data
	});
	
	var barChart = {
		itemId: chartDef.itemId,
		xtype: 'chart',
		title: chartDef.series[0].c02,
		legend: legend,
		height: initialSize.treeGridMaxHeight,
		flex: 1,
		animate: true, 
	    store: store,
	    axes: [{
	        type: 'Numeric',
	        position: 'left',
	        fields: yFields,
	        label: {
	            renderer: Ext.util.Format.numberRenderer('0,0.00')
	        },
	        grid: true,
	        minimum: 0
	    }, {
	        type: 'Category',
	        position: 'bottom',
	        fields: xFields
	    }],
	    series: series
//	    [{ type: 'bar',
//	        axis: 'bottom',
//	        highlight: true,
//	        column: true,
//	        tips: {
//	        	trackMouse: true,
//	        	width: 140,
//	        	height: 35,
//	        	renderer: function(storeItem, item) {
//	        		this.setTitle(storeItem.get('name') + ': ' + Ext.util.Format.number(item.value[1], '0,0.00'));
//	        	}
//	        },
//	        style: {
//	        	width: 50
//	        },
////	        label: {
////	        	display: 'insideEnd',
////	            field: yFields,
////	            renderer: function(storeItem) {
////	        		return Ext.util.Format.number(storeItem, '0,0.00');
////	            },
////	            orientation: 'horizontal',
////	            color: '#333',
////	            'text-anchor': 'middle'
////	        },
//	        xField: xFields,
//	        yField: yFields
////	        renderer: function(sprite, record, attr, index, store) {
////	        	var colors = ['rgb(47, 162, 223)',
////			                'rgb(60, 133, 46)',
////			                'rgb(234, 102, 17)',
////			                'rgb(154, 176, 213)',
////			                'rgb(186, 10, 25)',
////			                'rgb(40, 40, 40)'];
////
////	            return Ext.apply(attr, {
////	                fill: colors[index % colors.length]
////	            });
////	        }
//	    }]
	};
	
	var showChartInPopup = function() {
		cbs_publisher_instance.openChartInPopup(barChart);
	};
	
	barChart.listeners = {
    	click: showChartInPopup
    };
	
	return barChart;
}

CBSPublisher.prototype.openChartInPopup = function(chart) {
	$("body").append("<style type=\"text/css\">" +
			".cbsPublisherWhitePopup .x-window-body {" +
				"background-color: white;" +
			"}" +
		"</style>");
	
	chart.listeners = undefined;
	if (chart.legend === undefined) chart.legend = { position: 'bottom' };
	
	Ext.create('Ext.window.Window', {
	    title: chart.title,
	    modal: true,
	    height: 400,
	    width: 600,
	    cls:'cbsPublisherWhitePopup',
	    layout: 'fit',
	    bodyPadding: 10,
	    items: [
	        chart
	    ]
	}).show();
}

CBSPublisher.prototype.buildErrorMessageBox = function() {
	var sHTML = '<div id="8479143332_div3" class="gc_error_box" style="display: block;">' +
		'<div elementid="8479143332_once" style="display: block;">' +
		'<b>Code:</b> ' + this.error.code + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' +
		'<b>Description:</b> ' + this.error.description + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' +
		'<b>Explanation:</b> ' + this.error.explanation +
		'</div>' +
		'</div>';
	
	return sHTML;
}

CBSPublisher.prototype.buildBackLinksHTML = function() {
	var cbs_publisher_instance = this;
	var backLinksHTML = '';
	this.addBreadCrumbCSS();
	
	var addBackLink = function(placeholderId, reportName, stepNumber, currentStep) {
		var stepId = Math.uuid(10, 10) + '_' + stepNumber;
		
		var stepHTML = '';
		if (currentStep === true)
			stepHTML = "<span class=\"cbs_publisher_breadcrumbText cbs_publisher_current\">" + reportName + "</span>";
		else if(stepNumber == 0){
			stepHTML = "<span id=\"" + stepId + "\" class=\"cbs_publisher_breadcrumbText cbs_publisher_breadcrumbLink cbs_publisher_first\">" + reportName + "</span>";
//					"<img src=\"" + cbs_publisher_instance.IMAGES_URL + "breadcrumb.png\" class=\"breadcrumbSeparator\" />";
		}
		else
			stepHTML = "<span id=\"" + stepId + "\" class=\"cbs_publisher_breadcrumbText cbs_publisher_breadcrumbLink\">" + reportName + "</span>";
		
		if (currentStep === false) {
			$("body").on("click", "#" + stepId, function(event) {
				$("#" + cbs_publisher_instance.wgt_placeholder_id).hide("slide", { direction: "right" }, 300, function() {
					$("#" + placeholderId).show("slide", {}, 300, function() {});
					
					$("#" + cbs_publisher_instance.wgt_placeholder_id).remove(); //To avoid "wait" window bug
				});
			});
		}
		return stepHTML;
	};
	
	for (var idx = 0; idx < this.prev_wgt_placeholder_info.IDs.length; idx++) {// add 'previous' steps icons
		backLinksHTML = backLinksHTML + addBackLink(this.prev_wgt_placeholder_info.IDs[idx], this.prev_wgt_placeholder_info.repTitles[idx], idx, false);
	}
	
	if (this.prev_wgt_placeholder_info.IDs.length > 0)// add a 'current/last' step icon (not clickable)
		backLinksHTML = backLinksHTML + addBackLink(null, this.prev_wgt_placeholder_info.repTitles[this.prev_wgt_placeholder_info.IDs.length], this.prev_wgt_placeholder_info.IDs.length, true);
	
	return backLinksHTML;
}

CBSPublisher.prototype.addBreadCrumbCSS = function() {
	var css = document.createElement("style");
	css.type = "text/css";
	css.innerHTML += ".cbs_publisher_breadcrumbText { float: left; margin: 0 .5em 0 1em;}";
	css.innerHTML += ".cbs_publisher_breadcrumbText {background-image: -webkit-linear-gradient(left, #7394B5 0%, #9CB5CE 100%);" +
			" float: left; padding: 0 .5em 0 .5em;" +
			" text-decoration: none; color: white; text-shadow: 0 1px 0 rgba(255,255,255,.5);" +
			"position: relative;}";
	css.innerHTML += ".cbs_publisher_breadcrumbText:hover {color: #d78932}";
	css.innerHTML += ".cbs_publisher_breadcrumbText::before {content:''; position: absolute;" +
			"top: 50%; margin-top: -1.5em; border-width: 1.5em 0 1.5em 1em;" +
			"border-style: solid; border-color: #7394B5 #7394B5 #7394B5 transparent; left: -1em}";
	css.innerHTML += ".cbs_publisher_breadcrumbText::after {content: ''; position: absolute; top: 50%;" +
			"margin-top: -1.5em; border-top: 1.5em solid transparent; " +
			"border-bottom: 1.5em solid transparent; border-left: 1em solid #9CB5CE; right: -1em;}";
	css.innerHTML += ".cbs_publisher_current::after{content: normal;}";
	css.innerHTML += ".cbs_publisher_current::before{border-color: #d78932 #d78932 #d78932 transparent;}";
	css.innerHTML += ".cbs_publisher_current{border-top-right-radius: 2px; border-bottom-right-radius: 2px;" +
			"background: #d78932 !important;}";
	css.innerHTML += ".cbs_publisher_current:hover {color: white !important; cursor: default}";
	css.innerHTML += ".cbs_publisher_first::before{content:normal;border-top-right-radius: 2px; border-bottom-right-radius: 2px;}";
	css.innerHTML += ".cbs_publisher_breadcrumbLink:hover {cursor:pointer}";
	
	css.innerHTML += ".x-grid-cell-inner {margin-top:11px;margin-bottom:11px;}";
//	css.innerHTML += ".x-grid-cell {border-style:solid !important;border-width:1px !important}";
	css.innerHTML += ".x-tree-elbow-plus {position:relative;left:10px;background-image:none !important;z-index:1}";
	css.innerHTML += ".x-tree-elbow-end-plus {position:relative;left:10px;background-image:none !important;z-index:1}";
	css.innerHTML += ".x-tree-icon-parent {background-image:url('images/studio/bullet/dfs_tree_plus.gif');}";
	css.innerHTML += ".x-tree-icon-leaf {background-image:url('images/studio/bullet/dfs_tree_minus.gif');}";
	css.innerHTML += ".x-grid-tree-node-expanded .x-tree-icon-parent {background-image:url('images/studio/bullet/dfs_tree_minus.gif') !important;}";
	css.innerHTML += ".x-tree-icon {position:relative;left:-5px;}";
//	css.innerHTML += ".x-tree-elbow-line, .x-tree-elbow-end, .x-tree-elbow-empty {cursor:auto !important;}";
	
	document.body.appendChild(css);
}

var cbsPublisherTree = (function() {
	var getTreeAsJson = function(stream) {
		/*
		 * Tree node Object (uses Composite Design Pattern).
		 */
		function TreeNode(dataColumns, level) {
			// create main data columns
			if (dataColumns !== 'root') {
				for (var propName in dataColumns) {
					if (dataColumns.hasOwnProperty(propName)) {
						if (propName !== 'level')
							this[propName] = dataColumns[propName];
					}
				}
			} else {
				this.text = dataColumns;
			}
				
			this.level = level;
			this.children = new Array();
			this.parentNode = null;
			
			this.addChild = function(child) {
				child.parentNode = this;
				this.children.push(child);
			}
			
			this.getParentOfLevel = function(level) {
				if (this.parentNode.level < level)
					return this.parentNode;
				else
					return this.parentNode.getParentOfLevel(level);
			}
			
			this.getTreeAsStoreDef = function() {
				var result = null;
				
				if (this.text !== undefined)
					result = "{\"text\":\".\"";
				else {
					result = "{";
					for (var propName in this) {
						if (dataColumns.hasOwnProperty(propName)) {
							if (propName !== 'level') {
								result = result + "\"" + propName + "\":\"" + this[propName] + "\", ";
							}
						}
					}
					result = result.substring(0, result.length-2);
				}
				
				if (this.children.length == 0) {
					result = result + ", \"leaf\":true, \"iconCls\":\"x-tree-noicon\"}";
				}
				else {
					result = result + ", \"children\":[";
					for (var idx = 0; idx < this.children.length; idx++) {
						result = result + this.children[idx].getTreeAsStoreDef();
						if (idx !== (this.children.length-1))
							 result = result + ", ";
					}
					result = result + "], \"iconCls\":\"x-tree-noicon\"}";
				}
				return result;
			}
		}
		
		// Transform the stream array with 'level' attributes to the tree
		var currentNode = new TreeNode('root', 0);
		var rootNode = currentNode;
		
		for (var idx = 0; idx < stream.length; idx++) {
			var nextNode = new TreeNode(stream[idx], stream[idx].level);
			
			if (currentNode.level < nextNode.level) {
				currentNode.addChild(nextNode);
			}
			else if (currentNode.level == nextNode.level) {
				currentNode.parentNode.addChild(nextNode);//add to parent
			}
			else if (currentNode.level > nextNode.level) {
				var appropriateParent = currentNode.getParentOfLevel(nextNode.level);//look for the parent with the same level
				appropriateParent.addChild(nextNode);
			}
			currentNode = nextNode;
		}
		
		// Get the Tree as a JSON object
		var jsonObjectTree = JSON.parse( rootNode.getTreeAsStoreDef() );
		
		return jsonObjectTree;
	}
	
	return {
		getTreeAsJson : getTreeAsJson
	};
})();