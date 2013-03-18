/*
	Widget Publisher
	(c) 2013 - Capital Banking Solutions
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
	showCbsWaitMessage();
	
	if (cbs_publisher_instance == undefined || cbs_publisher_instance == null) {// called externally
		dataWidget.clearContent();
		var wgt_placeholder_id = Math.uuid( 10,10 );
		dataWidget.addContent("<div id=\"" + wgt_placeholder_id + "\" style=\"width:100%;height:auto;\"></div>");
		
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
	PLEASE_WAIT_CBS_WINDOW.hide();
}

/*
 * Displays the next report calling WS with dynamically defined parameters.
 * Called only internally, e.g. click on the Grid row - does new publisher, new screen.
 */
function cbsWidgetPublisherNextScreen(wsParamsAsString, prevPlaceholderInfo, dataWidgetName) {
	// preparing the WS parameters JSON object
	var wsParamsJsonObj = new Object();
	var wsParamsArray = wsParamsAsString.split(';');
	
	wsParamsJsonObj.usr = wsParamsArray[0];
	wsParamsJsonObj.lng = wsParamsArray[1];
	wsParamsJsonObj.roles = wsParamsArray[2];
	wsParamsJsonObj.newScreen = true;
	wsParamsJsonObj.sheetname = wsParamsArray[5];
	wsParamsJsonObj.client = wsParamsArray[6];
	wsParamsJsonObj.dataWidgetName = dataWidgetName;
	//var report = wsParamsArray[7];// for the future - to say that this is a publisher report
	
	// parameters 'p1'...'p5'
	for (var i = 8; i < wsParamsArray.length; i++) {
		wsParamsJsonObj["p" + (i-7)] = wsParamsArray[i];
	}
	
	$("#" + prevPlaceholderInfo.IDs[prevPlaceholderInfo.IDs.length-1]).hide("slide", { direction: "left" }, 500, function() {});// hide previous
	
	// new publisher, new screen - e.g. click on the Grid row
	var wgt_placeholder_id = Math.uuid( 10,10 );
	var dataWidget = dfGetDataWidget(dataWidgetName);
	console.log(dataWidgetName);
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
 * Main class - creates and dispalys all kind of reports.
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
	// general data
	this.DATA_QUERY_NAME = "qWidgetPublisher2";
	this.dataWidget = dataWidget;
	this.wgt_placeholder_id = wgt_placeholder_id;
	this.cbsWsSettings = cbsWsSettings;
	this.items = null;
	this.maxWidgetHeight = $(window).height() - 170;// minus footer+header
	this.maxWidgetWidth = $(window).width() - 120;// minus left menu
	
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
	
	// temporary variable mapping the second and first levels data
	this.lastParentIndex = 0;
	
	// charts panel id
	this.mainPanelId = "cbsPublisherMainPanel_" + this.wgt_placeholder_id;
	this.mainTitleId = "cbsPublisherMainTitle_" + this.wgt_placeholder_id;
	this.mainTitlePanelId = "cbsPublisherMainTitlePanel_" + this.wgt_placeholder_id;
	this.normalFormId = "cbsPublisherNormalForm_" + this.wgt_placeholder_id;
	this.collapsedFormId = "cbsPublisherCollapsedForm_" + this.wgt_placeholder_id;
	this.collapsedFormAndChartsPanelId = "cbsPublisherCollapsedFormAndCharts_" + this.wgt_placeholder_id;
	this.periodDimensionsId = "cbsPublisherPeriodDimensions_" + this.wgt_placeholder_id;
	this.errorMessageId = "cbsPublisherErrorMessage_" + this.wgt_placeholder_id;
	this.mainTreeId = "cbsPublisherMainTree_" + this.wgt_placeholder_id;
	this.mainGridId = "cbsPublisherMainGrid_" + this.wgt_placeholder_id;
	this.chartsPanelId = "cbsPublisherChartsPanel_" + this.wgt_placeholder_id;
	this.secondLevelTabsId = "cbsPublisherSecondLevelTabPanel_" + this.wgt_placeholder_id;
	this.nextScreenIconId = "nextScreenIcon_" + this.wgt_placeholder_id;
	this.searchDetailsIconId = "searchDetailsIcon_" + this.wgt_placeholder_id;
	
	this.POSSIBLE_TREE_LEVELS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
	
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
	
	// init the WsSettings using externally passed parameters
	this.cbsWsSettings.usr = 'MPELPEL';//real data
	//this.cbsWsSettings.usr = 'mp';//fake data
	this.cbsWsSettings.lng = user.locale.name;
	this.cbsWsSettings.roles = 'r';
	this.cbsWsSettings.client = '021249';
	//this.cbsWsSettings.client = '723867';
	//this.cbsWsSettings.client = null;
	
	//this.cbsWsSettings.sheetname = this.dataWidget.parameters.pkName;
	
	// REAL DATA
	//this.cbsWsSettings.sheetname = 'pk_dp_client.f_get_synthese_client';//0
	//this.cbsWsSettings.sheetname = 'pk_dp_encours.get_encours_cli';//1 - Good to test and to show
	//this.cbsWsSettings.sheetname = 'pk_dp_signalitique.F_get_signcli';//2
	//this.cbsWsSettings.sheetname = 'pk_dp_freshmoney.f_get_freshcli';//3 - Good to test
	this.cbsWsSettings.sheetname = 'pk_dp_statoper.get_opers_cli';//4 - TO CHECK - BAR CHARTS?!
	//this.cbsWsSettings.sheetname = 'pk_dp_dastat.f_get_client';//5 - GOOD TO SHOW,
		//but there is a pb: click on all tabs till 'change, click tab with second chart & click back tab with first - everything disappears
	//this.cbsWsSettings.sheetname = 'pk_dp_depass.get_depass_cli';//6 - optional
	//this.cbsWsSettings.sheetname = 'pk_dp_impas.f_get_impascli';//7
	//this.cbsWsSettings.sheetname = 'pk_dp_bale2.f_get_client';//8 - FIX THE SIZE!!!
	//this.cbsWsSettings.sheetname = 'pk_dp_oper.get_clioper';//9
	//this.cbsWsSettings.sheetname = 'pk_dp_dpoper.get_clioper_new';//10 - MULTI STEPS! Try FIRST and SECOND icons!
	//this.cbsWsSettings.sheetname = 'pk_dp_roles.F_get_roles';// ERROR - FUNCTIONAL
	//this.cbsWsSettings.sheetname = 'pk_dp_groupes.F_get_groupes';//11 - EMPTY
	//this.cbsWsSettings.sheetname = 'pk_dp_freshmoney.f_get_freshrm';// - TO FIX!
	
	// OLD FAKE REPORTS
	//this.cbsWsSettings.sheetname = 'PK_DP_QC_CPT2.report';
	//this.cbsWsSettings.sheetname = 'PK_DP_QC_CPT.report';
	//this.cbsWsSettings.sheetname = 'pk_dp_qc_supplier4.report';
	//this.cbsWsSettings.sheetname = 'pk_dp_qc_supplier3.report';
	//this.cbsWsSettings.sheetname = 'pk_dp_qc_supplier2.report';
	
	// get the clienId from the context and build the report
	dfGetContextValues(function(data) {
		var json_obj = JSON.parse(data);
		if (json_obj instanceof Array) {// get the clienId
			for (var i=0; i<json_obj.length; i++) {
				if (json_obj[i]["object"]=="faceliftingContext") {
					var sel_json_obj = json_obj[i];
					for (var j=0; j<sel_json_obj.properties.length; j++) {
						if (sel_json_obj.properties[j]["name"]=="selectedClient") {
							cbs_publisher_instance.cbsWsSettings.client = sel_json_obj.properties[j]["value"];
							break;
						}
					}
				}
			}
		}
		
		// build the report
		cbs_publisher_instance.buildReport();
	});
}

CBSPublisher.prototype.executeFromInternalCall = function() {
	this.buildReport();
}

CBSPublisher.prototype.buildReport = function() {
	var cbs_publisher_instance = this;
	
	var dq = new DataQuery(this.DATA_QUERY_NAME);
	dq.setParameters(this.cbsWsSettings);
	console.log(this.cbsWsSettings);
	
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
			cbs_publisher_instance.gridColumns.push({ header: "", dataIndex: "caction", width: 30 });
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
	
	// function to add the data for the "NextScreen icon" - used later when parsing...
	var buildNextScreenLink = function(item, row) {
		if (item.c19 || item.c20) {
			var firstNextScreenIcon = item.c19;
			var secondNextScreenIcon = item.c20;
			
			var addNextScreenIcon = function(nextScreenIconDef) {
				if (nextScreenIconDef == undefined || nextScreenIconDef == null)
					return;
				
				var wsParamsArray = nextScreenIconDef.split(';');
				
				if (row.caction == undefined || row.caction == null) {
					row.caction = "";
				}
				
				// add WS params that are not in nextScreenIconDef
				nextScreenIconDef = cbs_publisher_instance.cbsWsSettings.usr + ";" + cbs_publisher_instance.cbsWsSettings.lng + ";" +
						cbs_publisher_instance.cbsWsSettings.roles + ";" + nextScreenIconDef;
				
				// form the final link with parameters
				row.caction = row.caction + "<img id='" + cbs_publisher_instance.nextScreenIconId + "'" +
					" src='http://88.191.129.143/RestFixture/images/" + wsParamsArray[0] + ".png' title='" + wsParamsArray[1] +
					"' next_screen_def='" + nextScreenIconDef + "'/>";
			};
			
			if (firstNextScreenIcon !== undefined)
				addNextScreenIcon(firstNextScreenIcon);
			
			if (secondNextScreenIcon !== undefined)
				addNextScreenIcon(secondNextScreenIcon);
		}
	};
	
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
		if (formLabel !== null && formLabel !== undefined && formLabel !== "null" && formLabel !== "undefined") {
			if (Ext.String.trim(formLabel).length > 0) {
				if (item.dimName === "0")
					this.normalFormLevel_0.push({ label: formLabel, data: formData });
				else if (item.dimName === "-6")
					this.collapsedFormLevel_0.push({ label: formLabel, data: formData });
			}
		}
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
        if (colIndex === 1 && this.isItTree === true)
        	colDef.xtype = 'treecolumn';
        
        colDef.align = (item.c03 === "double") ? "right" : "left";
        colDef.widthToCalc = item.c05;

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
		//var report = item.c05;// for the future - to say that this is a publisher report
		
		// parameters 'p1'...'p5'
		for (var i = 6; i < 11; i++) {
			var nextP = (i<10) ? item["c0"+i] : item["c"+i];
			if (nextP !== undefined)
				wsParamsJsonObj["p" + (i-5)] = nextP;
		}
		
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
			row.rep_icon = "<img src='http://88.191.129.143/RestFixture/images/" + item.img + ".png' />";
		}
		
		row.long_descr = item.c16;// add a data to the tooltip column
		buildNextScreenLink(item, row);// add the data for the "NextScreen icon"
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
			var tempDate = Ext.Date.parse(item.c01, "d.m.Y");
			if (tempDate)
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
				this.gridsOrFormsLevel_2["gridColumns_" + tab_idx].push( {header: "", dataIndex: "caction", width: 30} );
				this.gridsOrFormsLevel_2["gridFields_" + tab_idx].push( {name: "caction"} );
			}
			
			buildNextScreenLink(item, row);// add the data for the "NextScreen icon"
				
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

CBSPublisher.prototype.setReportName = function(name) {
	if (name === null || name === undefined || name === "null" || name === "undefined")
		name = '';
	this.reportName = name;
}

CBSPublisher.prototype.calcCompsInitialSize = function() {
	var initialSize = new Object();
	initialSize.dimensionLinksMaxWidth = (this.maxWidgetWidth / 3 < 200) ? 200 : (this.maxWidgetWidth / 3);
	initialSize.dimensionLinksLabelMaxWidth = initialSize.dimensionLinksMaxWidth / 3;
	initialSize.treeGridMaxHeight = this.maxWidgetHeight * 6 / 10;
	initialSize.firstLevelChartsMaxHeight = this.maxWidgetHeight * 2 / 10;
	initialSize.mainPanelWidth = this.maxWidgetWidth;
    initialSize.mainPanelHeight = this.maxWidgetHeight;
    initialSize.collapsedFormWidth = this.maxWidgetWidth * 6 / 10;
    initialSize.chartsPanelWidth = this.maxWidgetWidth * 3 / 10;
	return initialSize;
}

CBSPublisher.prototype.calcCompsSize = function() {
	var formsHeight = 0;
	if (this.reportPanel.getComponent(this.normalFormId))
		formsHeight += this.reportPanel.getComponent(this.normalFormId).getHeight();
	
	formsHeight = formsHeight * 4;//TODO: this is a temp solution, in reality, the fieldset (collapsedForm) height must be taken into account but it behaves strangely
	
	var mainTreeGrid = (this.isItTree) ? this.reportPanel.getComponent(this.mainTreeId) : this.reportPanel.getComponent(this.mainGridId);
	var secondLevelTabs = this.reportPanel.getComponent(this.secondLevelTabsId);
	var collapsedForm = this.reportPanel.getComponent(this.collapsedFormAndChartsPanelId).getComponent(this.collapsedFormId);
	
	if (secondLevelTabs) {
		if (mainTreeGrid) {
			mainTreeGrid.setHeight((this.maxWidgetHeight * 4 / 10) - (formsHeight / 3));
			secondLevelTabs.setHeight((this.maxWidgetHeight * 4 / 10) - (formsHeight / 3));
		} else {
			secondLevelTabs.setHeight((this.maxWidgetHeight * 5 / 10) - (formsHeight / 3));
		}
	}
	else if (secondLevelTabs) {
		if (mainTreeGrid)
			mainTreeGrid.setHeight(this.maxWidgetHeight * 4 / 10 - formsHeight);
	}
	else if (secondLevelTabs === undefined) {
		if (mainTreeGrid)
			mainTreeGrid.setHeight(null);// adjust the height of the main tree/grid - 'null' means 'auto'
	}
	
	var chartsContainer = this.reportPanel.getComponent(this.collapsedFormAndChartsPanelId).getComponent(this.chartsPanelId);
	
	if (collapsedForm && mainTreeGrid && secondLevelTabs) {
		var formOrChartHeight = (collapsedForm) ? collapsedForm.getHeight() : chartsContainer.getHeight();
		mainTreeGrid.setHeight((this.maxWidgetHeight - formOrChartHeight) / 2 - 20);//-60
		secondLevelTabs.setHeight((this.maxWidgetHeight - formOrChartHeight) / 2 - 20);
	}
	
	if (chartsContainer.isHidden())
		this.calcCollapsedFormAndChartsSize(false);
	else
		this.calcCollapsedFormAndChartsSize(true);
	
	if (mainTreeGrid && collapsedForm === undefined && secondLevelTabs === undefined)
		mainTreeGrid.setHeight(this.maxWidgetHeight / 2 - formsHeight);
}

CBSPublisher.prototype.calcCollapsedFormAndChartsSize = function(isChartsVisible) {
	var collapsedForm = this.reportPanel.getComponent(this.collapsedFormAndChartsPanelId).getComponent(this.collapsedFormId);
	var chartsContainer = this.reportPanel.getComponent(this.collapsedFormAndChartsPanelId).getComponent(this.chartsPanelId);
    
    if (collapsedForm && isChartsVisible) {
    	collapsedForm.setWidth(this.maxWidgetWidth * 6 / 10);
    	chartsContainer.setWidth(this.maxWidgetWidth - collapsedForm.getWidth() - 20);
    }
    else if (collapsedForm) {
    	collapsedForm.setWidth(this.maxWidgetWidth);
    }
    
    if (collapsedForm && chartsContainer)
    	chartsContainer.setHeight( collapsedForm.getHeight() );
}

CBSPublisher.prototype.renderReport = function() {
	console.log(this);
	var cbs_publisher_instance = this;
	var panel_items = new Array();
	var initialSize = this.calcCompsInitialSize();// get the components initial size
	
	// main title
	var titlePanelItems = new Array();
	titlePanelItems.push({
		itemId: this.mainTitleId,
		border: false,
		html: "<b><p style='font-size:20px'>" + this.reportName + "</p></b></br>",
		columnWidth: 0.5
	});
	
	// back link
	titlePanelItems.push({
		border: false,
		html: this.buildBackLinksHTML(),
		columnWidth: 0.5
	});
	
	// add title & back button to the separate panel that will be added to the main panel items
	panel_items.push({
		itemId: this.mainTitlePanelId,
		border: false,
		layout: {
    	    type: "column"
		},
    	items: titlePanelItems
	});
	
	// zero level - normal form
	if (this.normalFormLevel_0.length > 0) {
		var html = "<table style='font-size:12px;' width='100%'><tr>";// put data in 1 row
		for (var i = 0; i < this.normalFormLevel_0.length; i++) {
			html = html + "<td>" + this.normalFormLevel_0[i].label + ": </td><td><b>" + this.normalFormLevel_0[i].data + "</b></td>";
		}
		html += "</tr></table>";
		
		panel_items.push({
			itemId: this.normalFormId,
			border: false,
			html: html
		});
		
		panel_items.push({ xtype: "splitter" });// splitter between the levels
	}
	
	// first level - charts: build
	var charts = this.buildCharts(1, 0);
	
	// zero level - collapsed form
	var collapsedFormAndChartsPanelItems = new Array();
	if (this.collapsedFormLevel_0.length > 0) {
		var html = "<table style='font-size:12px; border-spacing: 2 !important; border-collapse: separate !important;' width='100%'>";// put data in several rows, 3 columns
		for (var i = 0; i < this.collapsedFormLevel_0.length; i++) {
			var tableRowTmpl = "<td>{0}</td><td><b>{1}</b></td>";
			
			var tableRow = null;
			tableRow = Ext.String.format(tableRowTmpl, this.collapsedFormLevel_0[i].label, this.collapsedFormLevel_0[i].data);
			if ((i + 1) < this.collapsedFormLevel_0.length)
				tableRow += Ext.String.format(tableRowTmpl, this.collapsedFormLevel_0[++i].label, this.collapsedFormLevel_0[i].data);
			if ((i + 1) < this.collapsedFormLevel_0.length)
				tableRow += Ext.String.format(tableRowTmpl, this.collapsedFormLevel_0[++i].label, this.collapsedFormLevel_0[i].data);
				
			if (tableRow !== null)
				html = html + "<tr>" + tableRow + "</tr>";
		}
		html += "</table>";
		
		collapsedFormAndChartsPanelItems.push({
			itemId: this.collapsedFormId,
			xtype: 'fieldset',
			collapsible: true,
			margin: '0, 20, 0, 0',
			collapsed: false,// initially collapsed or not?
			title: "<b>" + this.collapsedFormLevel_0_title + "</b>",
			html: html,
			width: initialSize.collapsedFormWidth
		});
	}
	
	// first level - charts: create a panel
	var chartItems = new Array();
	for (var i = 0; i < charts.length; i++) {
		chartItems.push( charts[i] );
	}
	var chartsPanelDef = {
		xtype: 'tabpanel',
    	itemId: this.chartsPanelId,
	    width: initialSize.chartsPanelWidth,
    	items: chartItems,
    	plain: true,
    	activeTab: 0,
    	tabPosition: 'bottom',
    	margin: '7, 0, 0, 0'
	};
	collapsedFormAndChartsPanelItems.push(chartsPanelDef);
	
	if (charts.length === 0)
		chartsPanelDef.hidden = true;
	
	// add collapsed form & charts to the separate panel that will be added to the main panel items
	panel_items.push({
		itemId: this.collapsedFormAndChartsPanelId,
		border: false,
		layout: {
    	    type: "hbox"
		},
    	items: collapsedFormAndChartsPanelItems
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
			maxWidth: initialSize.dimensionLinksMaxWidth,
			labelWidth: initialSize.dimensionLinksLabelMaxWidth,
			xtype: 'combobox',
		    fieldLabel: 'Period',
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
	
	// FIRST level - grid or tree
	// 1) rearrange the icon column position: it must always be the second visible column
	if (this.gridColumns[2] !== undefined && this.gridColumns[2].dataIndex === 'rep_icon') {
		var iconCol = this.gridColumns[2];
		this.gridColumns[2] = this.gridColumns[3];
		this.gridColumns[3] = iconCol;
	}
	
	// 2) create and add a grid or tree item
	var optimizedColumns = this.optimizeColumnsSize(this.gridColumns);
	if (this.isItTree) {
		// prepare the data for the TreeStore and get them as a JSON object
		var store_def_as_json = cbsPublisherTree.getTreeAsJson(this.gridData_level_1);
		
		// Create a Tree component using the prepared data
		if (store_def_as_json.children !== undefined) {
			panel_items.push({
				xtype: "treepanel",
				itemId: this.mainTreeId,
				maxHeight: initialSize.treeGridMaxHeight,
				useArrows: true,
				rootVisible: false,
		    	columns: optimizedColumns,
			    store: Ext.create("Ext.data.TreeStore", { fields: this.gridFields_level_1, root: store_def_as_json }),
			    listeners: {
			    	itemclick: function(view, record, item, index, e) {
			    		cbs_publisher_instance.gridTreeClickAction(e, record);
			    	}
		    	}
			});
		}
	}
	else {
		if (this.gridData_level_1.length > 0) {
			panel_items.push({
				xtype: "grid",
				itemId: this.mainGridId,
				maxHeight: initialSize.treeGridMaxHeight,
		    	columns: optimizedColumns,
			    store: Ext.create("Ext.data.Store", { fields: this.gridFields_level_1, data: this.gridData_level_1 }),
		    	listeners: {
			    	itemclick: function(grid, record, item, index, e) {
			    		cbs_publisher_instance.gridTreeClickAction(e, record);
			    	}
		    	}
			});
		}
	}
	
	// main panel
	this.reportPanel = Ext.create('Ext.panel.Panel', {
		itemId: this.mainPanelId,
    	width: initialSize.mainPanelWidth,
	    height: initialSize.mainPanelHeight,
	    overflowX: "auto",
	    overflowY: "auto",
	    border: false,
    	renderTo: this.wgt_placeholder_id,
	    layout: {
    	    type: "vbox",
        	align: "stretch",
        	defaultMargins: {top: 4, right: 0, bottom: 0, left: 0}
    	},
	    items: panel_items
	});
	
	this.buildSecondLevelTabs("0", 0);// second level - tabs
	this.calcCompsSize();// adjust the components size
	
	closeCbsWaitMessage();
}

CBSPublisher.prototype.optimizeColumnsSize = function(gridColumns) {
	var largestColumn = {index: 0, width: 0};
	for (var i = 0; i < gridColumns.length; i++) {
		if (parseInt(gridColumns[i].widthToCalc) > parseInt(largestColumn.width)) {
			largestColumn.width = gridColumns[i].widthToCalc;
			largestColumn.index = i;
		}
	}
	
	//gridColumns[ largestColumn.index ].minWidth = gridColumns[ largestColumn.index ].widthToCalc;
	gridColumns[ largestColumn.index ].flex = 1;
	return gridColumns;
}

/*
 * Private function, called only internally - by the itemclick() grid/tree listeners.
 */
CBSPublisher.prototype.gridTreeClickAction = function(event, record) {
	var cbs_publisher_instance = this;
	
	if (event.target.id === this.nextScreenIconId) {
		var nextScreenIconDef = $(event.target).attr('next_screen_def');
		
		var prevPlaceholderInfo = new Object();
		prevPlaceholderInfo.IDs = new Array();
		prevPlaceholderInfo.repTitles = new Array();
		
		// add previous placeholder_info
		$.extend(prevPlaceholderInfo.IDs, cbs_publisher_instance.prev_wgt_placeholder_info.IDs);
		$.extend(prevPlaceholderInfo.repTitles, cbs_publisher_instance.prev_wgt_placeholder_info.repTitles);
		
		// add current placeholder_info
		prevPlaceholderInfo.IDs.push(cbs_publisher_instance.wgt_placeholder_id);
		prevPlaceholderInfo.repTitles.push(cbs_publisher_instance.reportName);
		
		cbsWidgetPublisherNextScreen(nextScreenIconDef, prevPlaceholderInfo, cbs_publisher_instance.dataWidget.getName());
	}
	else if (event.target.id === this.searchDetailsIconId) {
		cbs_publisher_instance.renderSecondLevelComps( record.get('row_id') );// second level - tabs
		
		//console.log(cbs_publisher_instance.reportPanel);
		//console.log(cbs_publisher_instance.reportPanel.renderTo);
		//console.log(cbs_publisher_instance.reportPanel.isHidden());
		
		//$("#"+cbs_publisher_instance.reportPanel.renderTo).show();
		
		//cbs_publisher_instance.reportPanel.doLayout();
		//cbs_publisher_instance.reportPanel.show();
		//cbs_publisher_instance.reportPanel.updateLayout();
	}
}

CBSPublisher.prototype.refreshReport = function() {
	// select the dimension link if the report was reloaded
	if (this.dimensionLinks.length > 0) {
		var dimensionsCombo = this.reportPanel.getComponent(this.periodDimensionsId);
	}
	
	// remove all components except title, dimension links, error message and main tree/grid
	for (var i = 0; i < this.reportPanel.items.length; i++) {
		var compItemId = this.reportPanel.items.getAt(i).getItemId();
		if (compItemId !== this.mainTitlePanelId && compItemId !== this.periodDimensionsId &&
				compItemId !== this.errorMessageId && compItemId !== this.mainTreeId && compItemId !== this.mainGridId)
		{
			this.reportPanel.remove( this.reportPanel.getComponent(compItemId) );
		}
	}
	// somehow, second leel tabs & charts are not in the panel.items(), so delete them personally
	this.reportPanel.remove( this.reportPanel.getComponent(this.secondLevelTabsId) );
	this.reportPanel.remove( this.reportPanel.getComponent(this.chartsPanelId) );
	
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
			if (compItemId !== this.mainTitlePanelId && compItemId !== this.periodDimensionsId && compItemId !== this.errorMessageId) {
				comp.hide();
			}
			else if (compItemId === this.mainTitlePanelId || compItemId === this.periodDimensionsId || compItemId === this.errorMessageId) {
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
	}
	
	// reload the tree or grid with new data
	if (this.isItTree) {
		var mainTree = this.reportPanel.getComponent(this.mainTreeId);
		var store_def_as_json = cbsPublisherTree.getTreeAsJson(this.gridData_level_1);
		mainTree.setRootNode(store_def_as_json);
	} else {
		var mainGrid = this.reportPanel.getComponent(this.mainGridId);
		var newStore = Ext.create("Ext.data.Store", { fields: this.gridFields_level_1, data: this.gridData_level_1 });
		mainGrid.reconfigure(newStore);
	}
	
	this.calcCompsSize();// adjust the components size
	this.reportPanel.doLayout();// for the case if some second level components were removed
}

/*
 * Create Tab with second level nested grids. Must be invoked by clicking on the row in the first level grid.
 */
CBSPublisher.prototype.renderSecondLevelComps = function(parentIndex) {
	/*
	NEW CONDITIONS:
		this.cbsWsSettings.sheetname = 'pk_dp_dastat.f_get_client';//5 - GOOD TO SHOW,
		//but there is a pb: click on all tabs till 'change, click tab with second chart & click back tab with first - everything disappears 
	-------------------------------------------------------------------------------------------------------------------------------------------------------------------
	NEXT ACTION: Check if there is an error when commenting out panel.add() & tab.add() (and remove) functions! Try to detect, when it's hidden and refresh the screen?
	NEXT ACTION 2: do not call buildSecondLevelTabs() 3 times, but call only for the clicked node level (or just 1, if it's a grid, not tree)
	
	
	IDEA N1: give to all components UNIQUE itemIDs. If it does not work, give unique itemIds even to the components which IDs I don't use anywhere.
	Test: click 20 times on Fieldset.
	
	Note: icons & loop also have IDs!
	
	 */
	/*
	2 conditions:
	1) 2 reports, second is accessed via "details" icon (this.cbsWsSettings.sheetname = 'PK_DP_QC_CPT.report';)
	2) using buildSecondLevelComps() function OR this.calcCompsSize() (using second function takes longer time to crash)
	3) it's probably something with using the "this" or "pub_inst" variables
	   - try to replace all IDs for hard-coded strings
	   - or/and avoid using "this" and "pub_inst" somehow
	   
	SUPER IDEA: console.log(this) and compare it after disappearing with the previous version. Line by line.
	            Something with main panel layout may be?
	            
	http://www.sencha.com/forum/showthread.php?219472-Custom-component-keeps-mysteriously-disappearing
	
	ANOTHER IDEA: look at forums - Fieldset hides everything, not only itself!
	
	ANOTHER IDEA: hide not DIV but the panel - and USE SENCHA for hiding!
	*/
	
	// build tabs of the second level
	for (var i = 0; i < this.POSSIBLE_TREE_LEVELS.length; i++) {
		if (this.buildSecondLevelTabs(this.POSSIBLE_TREE_LEVELS[i], parentIndex))
			break;
	}
	
	// build charts of the second level
	this.buildSecondLevelCharts(2, parentIndex);
	
	this.calcCompsSize();// adjust the components size
	
	// scroll to selected row in the first level grid
	var mainTreeGrid = (this.isItTree) ? this.reportPanel.getComponent(this.mainTreeId) : this.reportPanel.getComponent(this.mainGridId);
	if (mainTreeGrid) {
		var lastSelectedRow = mainTreeGrid.getSelectionModel().getLastSelected();
		if (lastSelectedRow) {
			var lastSelectedIndex = lastSelectedRow.index;
			mainTreeGrid.getView().focusRow(lastSelectedIndex);
		}
	}
}

CBSPublisher.prototype.buildSecondLevelTabs = function(treeIndex, parentIndex) {
	//console.log(this);
	var cbs_publisher_instance = this;
	var tabIndex = 0;
	
	if (this.gridsOrFormsLevel_2["reportName_" + treeIndex + tabIndex]) {
		var parseContinue = true;
		var items = new Array();
		
		// tabs: grids & forms
		while (parseContinue) {
			if (this.gridsOrFormsLevel_2["reportName_" + treeIndex + tabIndex]) {
				if (this.gridsOrFormsLevel_2["gridData_" + treeIndex + tabIndex]) {// if it was defined, it's a table data
					var gridData = new Array();
					var currTabAllData = this.gridsOrFormsLevel_2["gridData_" + treeIndex + tabIndex];
					for (var i = 0; i < currTabAllData.length + 1; i++) {
						if (currTabAllData[i] && (currTabAllData[i].parentIndex == parentIndex))
							gridData.push( currTabAllData[i].row );
					}
					
					if (gridData.length > 0) {
						var item = {
							title: this.gridsOrFormsLevel_2["reportName_" + treeIndex + tabIndex],
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
						items.push(item);
					}
				}
				else {// it's a form data
					var html = "<table style='font-size:12px;' width='100%'>";// put data in several rows, 3 columns
					var currTabAllData = this.gridsOrFormsLevel_2["formData_" + treeIndex + tabIndex];
					if (currTabAllData) {
						var tableRowTmpl = "<td>{0}</td><td><b>{1}</b></td>";
						
						for (var i = 0; i < currTabAllData.length; i++) {
							if (currTabAllData[i] && (currTabAllData[i].parentIndex == parentIndex)) {
								var tableRow = null;
								tableRow = Ext.String.format(tableRowTmpl, currTabAllData[i].label, currTabAllData[i].data);
								if ((i + 1) < currTabAllData.length)
									tableRow += Ext.String.format(tableRowTmpl, currTabAllData[++i].label, currTabAllData[i].data);
								if ((i + 1) < currTabAllData.length)
									tableRow += Ext.String.format(tableRowTmpl, currTabAllData[++i].label, currTabAllData[i].data);
									
								if (tableRow !== null)
									html = html + "<tr>" + tableRow + "</tr>";
							}
						}
					}
					html += "</table>";
					
					if (! currTabAllData)
						html = 'There is no information';
					
					var item = {
						title: this.gridsOrFormsLevel_2["reportName_" + treeIndex + tabIndex],
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
		
		// build the Tab container
		var newTabs = null;
		if (items.length > 0) {
			newTabs = Ext.create('Ext.tab.Panel', {// tabs
				itemId: this.secondLevelTabsId,
				plain: true,
				items: items
			});
		}
		
		// remove previous tabs if exists
		if ( this.reportPanel.getComponent(this.secondLevelTabsId) ) {
			this.reportPanel.remove( this.reportPanel.getComponent(this.secondLevelTabsId) );
		}
		
		// add new tabs
		if (newTabs !== null) {
			this.reportPanel.add(newTabs);
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
		var chartsContainer = this.reportPanel.getComponent(this.collapsedFormAndChartsPanelId).getComponent(this.chartsPanelId);
		
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
			this.calcCollapsedFormAndChartsSize(true);
			chartsContainer.show();
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
	var data = new Array();
	for (var i = 0; i < chartDef.series.length; i++) {
		data.push({ 'name': chartDef.series[i].c02, 'data': parseFloat(chartDef.series[i].c03) });
	}
	
	var store = Ext.create('Ext.data.JsonStore', {
	    fields: ['name', 'data'],
	    data: data
	});
	
	var pieChart = {
		itemId: chartDef.itemId,
		xtype: 'chart',
		title: chartDef.series[0].c01,
		height: initialSize.firstLevelChartsMaxHeight,
		animate: true, 
	    store: store, theme: 'Base:gradients', shadow: true,
	    legend: { position: 'right' },
	    series: [{
	    	type: 'pie', angleField: 'data', showInLegend: true, 
	        tips: {
	            trackMouse: true,  width: 200, height: 28,
	            renderer: function(storeItem) {// calculate and display percentage on hover
	                var total = 0;
	                store.each(function(rec) { total += rec.get('data'); });
	                if (total !== 0)
	                	this.setTitle(storeItem.get('name') + ': ' + Math.round(storeItem.get('data') / total * 100) + '%');
	                else
	                	this.setTitle(storeItem.get('name') + ': ' + Math.round( storeItem.get('data') ) + '%');
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
	                if (total !== 0)
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

CBSPublisher.prototype.buildLineChart = function(chartDef) {
	var cbs_publisher_instance = this;
	var initialSize = this.calcCompsInitialSize();// get the components initial size
	var fields = new Array();
	var fieldsVertAxe = new Array();
	var data = new Array();
	var axes = new Array();
	var series = new Array();
	
	fields.push('name');
	
	if (chartDef.series) {
		for (var i = 0; i < chartDef.series.length; i++) {
			if ($.inArray(chartDef.series[i].c02, fields) === -1) {
				fields.push( chartDef.series[i].c02 );
				fieldsVertAxe.push( chartDef.series[i].c02 );
				
				series.push({ type: 'line', axis: 'left', xField: 'name', yField: chartDef.series[i].c02, 
					highlight: {size: 7, radius: 7}, markerConfig: {type: 'cross', size: 4, radius: 4, 'stroke-width': 0} });
			}
			
			var dataItem = new Object();
			if (chartDef.graphType === 'date')
				dataItem.name = new Date(chartDef.series[i].c01.replace( /(\d{2}).(\d{2}).(\d{4})/, "$2/$1/$3")).getTime();
			else if (chartDef.graphType === 'number')
				dataItem.name = parseFloat(chartDef.series[i].c01);
			dataItem[ chartDef.series[i].c02 ] = parseFloat( chartDef.series[i].c03 );
			data.push(dataItem);
		}
		
		axes.push({ type: 'Numeric', position: 'left', fields: fieldsVertAxe, label: {renderer: Ext.util.Format.numberRenderer('0,0'), font: '10px Arial'}, grid: true, hidden: false });
		if (chartDef.graphType === 'date')
			axes.push({ type: 'Time', dateFormat: 'Y M d', position: 'bottom', fields: ['name'], grid: false, hidden: false, label: {font: '10px Arial'} });
		else if (chartDef.graphType === 'number')
			axes.push({ type: 'Numeric', position: 'bottom', fields: ['name'], grid: true, hidden: false, label: {font: '10px Arial'} });
		
		var store = Ext.create('Ext.data.JsonStore', {
			fields: fields,
		    data: data
		});
		
		var lineChart = {
			itemId: chartDef.itemId,
			xtype: 'chart',
			title: chartDef.label,
			style: 'background:#fff',
		    height: initialSize.firstLevelChartsMaxHeight,
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
	var data = new Array();
	for (var i = 0; i < chartDef.series.length; i++) {
		data.push({ 'name': chartDef.series[i].c01, 'data': parseFloat(chartDef.series[i].c03) });
	}
	
	var store = Ext.create('Ext.data.JsonStore', {
	    fields: ['name', 'data'],
	    data: data
	});
	
	var barChart = {
		itemId: chartDef.itemId,
		xtype: 'chart',
		title: chartDef.series[0].c02,
		height: initialSize.firstLevelChartsMaxHeight,
		animate: true, 
	    store: store,
	    axes: [{
	        type: 'Numeric',
	        position: 'left',
	        fields: ['data'],
	        label: {
	            renderer: Ext.util.Format.numberRenderer('0.000')
	        },
	        grid: true,
	        minimum: 0
	    }, {
	        type: 'Category',
	        position: 'bottom',
	        fields: ['name']
	    }],
	    series: [{
	        type: 'bar',
	        axis: 'bottom',
	        highlight: true,
	        column: true,
	        tips: {
	        	trackMouse: true,
	        	width: 140,
	        	height: 28,
	        	renderer: function(storeItem, item) {
	        		this.setTitle(storeItem.get('name') + ': ' + Ext.util.Format.number(storeItem.get('data'), '0.000'));
	        	}
	        },
	        label: {
	        	display: 'insideEnd',
	            field: 'data',
	            //renderer: Ext.util.Format.numberRenderer('0.000'),
	            renderer: function(storeItem) {
	        		return Ext.util.Format.number(storeItem, '0.000');
	            },
	            orientation: 'horizontal',
	            color: '#333',
	            'text-anchor': 'middle'
	        },
	        xField: 'name',
	        yField: 'data'
	    }]
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
	if (chart.legend === undefined && chart.series[0].type !== 'bar') chart.legend = { position: 'bottom' };
	
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
		'<img elementid="8479143332_img" src="images/icon/bt_close.gif" class="gc_close_button" style="display: none;">' +
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
	var wizardCSS = '<style type="text/css">' +
		'nav {' +
	    'background: #eee;' +
	    'border: 1px solid #bbb;' +
	    '-webkit-border-radius: 2px;' +
	    '-moz-border-radius: 2px;' +
	    'border-radius: 2px;' +
	    'color: #666;' +
	    'font: 14px/1 "Myriad Pro", Arial, Helvetica, Tahoma, sans-serif;' +
	    'height: 30px;' +
	    'text-shadow: 0 1px 1px #fff;' +
	    'overflow: hidden;' +
	    'margin: 0px;' +
		'}' +
		'nav ul {' +
		    'float: left;' +
		'}' +
		'nav ul li {' +
		    'float: right;' +
		    'padding: 8px 0;' +
		    //'text-overflow: ellipsis;' +
		    //'width: 150px;' +
		    'text-indent: 37px;' +
		'}' +
		'nav ul li:last-child {' +
		    'margin-left: -15px;' +
		'}' +
		'nav ul li a {' +
		    'background: #ddd;' +
		    'background-image: -webkit-linear-gradient(left top, #eee 38%, #ddd 61%);' +
		    'background-image: -moz-linear-gradient(left top, #eee 38%, #ddd 61%);' +
		    'background-image: -o-linear-gradient(left top, #eee 38%, #ddd 61%);' +
		    'background-image: -ms-linear-gradient(left top, #eee 38%, #ddd 61%);' +
		    'background-image: linear-gradient(left top, #eee 38%, #ddd 61%);' +
		    'border: 1px solid #ccc;' +
		    'color: #666;' +
		    'display: block;' +
		    'line-height: 12px;' +
		    'margin-top: -60px;' +
		    'padding: 60px 0;' +
		    'text-decoration: none;' +
		    'text-shadow: 0 1px 1px #fff;' +
		    'width: 132px;' +
		    '-webkit-transform: rotate(45deg);' +
		    '-moz-transform: rotate(45deg);' +
		    '-o-transform: rotate(45deg);' +
		    '-ms-transform: rotate(45deg);' +
		    'transform: rotate(45deg);' +
		'}' +
		'nav ul li a:hover {' +
		    'background: #ddd;' +
		    'background-image: none;' +
		'}' +
		'nav ul li a:active, nav ul li a:focus {' +
		    'outline: 0;' +
		'}' +
		'nav ul li a span {' +
		    'display: block;' +
		    '-webkit-transform: rotate(-45deg);' +
		    '-moz-transform: rotate(-45deg);' +
		    '-o-transform: rotate(-45deg);' +
		    '-ms-transform: rotate(-45deg);' +
		    'transform: rotate(-45deg);' +
		'}' +
		'nav ul li a:active span {' +
		    'bottom: -1px;' +
		    'left: 1px;' +
		    'position: relative;' +
		'}' +
	'</style>';
	
	var addBackLink = function(placeholderId, reportName, stepNumber, currentStep) {
		var stepId = Math.uuid(10, 10) + '_' + stepNumber;
		
		var stepHTML = '';
		if (currentStep === true)
			stepHTML = '<li>' + reportName + '</li>';
		else
			stepHTML = '<li><a href="#" id="' + stepId + '"><span>' + reportName + '</span></a></li>';
		
		if (currentStep === false) {
			$("body").on("click", "#" + stepId, function(event) {
				//TODO: must be destroyed! not only hidden!
				$("#" + cbs_publisher_instance.wgt_placeholder_id).hide("slide", { direction: "right" }, 300, function() {
					$("#" + placeholderId).show("slide", {}, 300, function() {});
				});
			});
		}
		return stepHTML;
	};
	
	for (var idx = 0; idx < this.prev_wgt_placeholder_info.IDs.length; idx++) {// add 'previous' steps icons
		backLinksHTML = addBackLink(this.prev_wgt_placeholder_info.IDs[idx], this.prev_wgt_placeholder_info.repTitles[idx], idx, false) + backLinksHTML;
	}
	
	if (this.prev_wgt_placeholder_info.IDs.length > 0)
		backLinksHTML = addBackLink(null, this.reportName, this.prev_wgt_placeholder_info.IDs.length, true) + backLinksHTML;// add a 'current/last' step icon (not clickable)
	
	if (backLinksHTML !== '')
		backLinksHTML = '<nav><ul>' + backLinksHTML + '</ul></nav>' + wizardCSS;
	
	return backLinksHTML;
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