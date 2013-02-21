/*
	Widget Publisher
	(c) 2013 - Capital Banking Solutions
*/

/*
 * Notes:
 * 1) Rows number is never more than 2000. So, it's useless to implement 'paging' mechanism for the performance.
 * 2) Probably, it makes sense to add a 'PagingToolbar' but anyway, all the data are downloading in one request.
 * 3) ClientID is taken from the context. That means, the appropriate object MUST be in the context. To empty it,
 *    this object must be put in the context with any negative value , e.g. -1.
 */

/*
 * Widget entry point. 
 */
function cbsWidgetPublisher(dataWidget, inPopup, wsParams, popupCallback, periodTitleSelected, doNotClearContent, cbs_publisher_instance) {
	// DataQuery settings
	cbsPublisherSettings = new CBSPublisherSettings(dataWidget, inPopup, wsParams, popupCallback, periodTitleSelected, doNotClearContent, cbs_publisher_instance);
	/*if (wsParams === undefined || wsParams === null)
		wsParams = cbsPublisherSettings;*/
	//console.log("init: " + wsParams.client);
	
	// widget content creation
	/*var wgt_placeolder_id = (cbs_publisher_instance !== undefined) ? cbs_publisher_instance.wgt_placeolder_id : null;
	if (doNotClearContent !== true) {
		dataWidget.clearContent();
		wgt_placeolder_id = Math.uuid( 10,10 );
		dataWidget.addContent( "<div id=\"" + wgt_placeolder_id + "\" style=\"width:100%;height:auto;\"></div>" );
	}
	
	inPopup = (inPopup === true) ? true : false;
	cbsPublisherDataQueryExecute(dataWidget, wgt_placeolder_id, inPopup, wsParams, popupCallback, periodTitleSelected, doNotClearContent, cbs_publisher_instance);*/
}

/*
 * Global object to store the data query parameters.
 */
var cbsPublisherSettings = null;
function CBSPublisherSettings(dataWidget, inPopup, wsParams, popupCallback, periodTitleSelected, doNotClearContent, cbs_publisher_instance) {
	var cbs_settings_instance = this;
	
	this.dataWidget = dataWidget;
	this.usr = 'mp';
	this.lng = user.locale.name;
	this.roles = 'r';
	this.sheetname = this.dataWidget.parameters.pkName;
	//hard coded testing parameters:
	//this.sheetname = 'PK_DP_QC_CPT2.report';
	//this.sheetname = 'pk_dp_qc_supplier4.report';
	//this.sheetname = 'pk_dp_qc_supplier3.report';
	//this.sheetname = 'pk_dp_qc_supplier2.report';
	this.client = null;
	
	// get the clienId from the context
	dfGetContextValue("faceliftingContext", "selectedClient", function(data) {
		cbs_settings_instance.client = data;//501;
		console.log("context backup: " + cbs_settings_instance.client);
		
		// start the widget content creation here, after getting the clientId parameter from the context
		/*var wgt_placeolder_id = (cbs_publisher_instance !== undefined) ? cbs_publisher_instance.wgt_placeolder_id : null;
		if (doNotClearContent !== true) {
			dataWidget.clearContent();
			wgt_placeolder_id = Math.uuid( 10,10 );
			dataWidget.addContent( "<div id=\"" + wgt_placeolder_id + "\" style=\"width:100%;height:auto;\"></div>" );
		}
		
		inPopup = (inPopup === true) ? true : false;
		
		cbsPublisherDataQueryExecute(dataWidget, wgt_placeolder_id, inPopup, cbs_settings_instance, popupCallback, periodTitleSelected, doNotClearContent, cbs_publisher_instance);*/
	});
	
	var wgt_placeolder_id = (cbs_publisher_instance !== undefined) ? cbs_publisher_instance.wgt_placeolder_id : null;
	if (doNotClearContent !== true) {
		dataWidget.clearContent();
		wgt_placeolder_id = Math.uuid( 10,10 );
		dataWidget.addContent( "<div id=\"" + wgt_placeolder_id + "\" style=\"width:100%;height:auto;\"></div>" );
	}
	
	inPopup = (inPopup === true) ? true : false;
	cbsPublisherDataQueryExecute(dataWidget, wgt_placeolder_id, inPopup, wsParams, popupCallback, periodTitleSelected, doNotClearContent, cbs_publisher_instance);
}

function cbsPublisherDataQueryExecute(dataWidget, wgt_placeolder_id, inPopup, wsParams, popupCallback, periodTitleSelected, doNotClearContent, cbs_publisher_instance) {
	if (wsParams !== null)
		console.log("wsParams !== null, cbsPublisherDataQueryExecute: " + wsParams.client);
	else
		console.log("wsParams == null, cbsPublisherDataQueryExecute: " + wsParams);
	
	var dq = new DataQuery( "qWidgetPublisher" );
	
	if (wsParams !== undefined && wsParams !== null)
		dq.setParameters(wsParams);
	
	dq.execute( null, function(dataSet) {
		var buffer = dataSet.getData();
		if ( buffer !== null && buffer["coResultVal"] !== null ) {
			var items = buffer.coResultVal;
			//var items = buffer[0].coResultVal;
			
			var publisher = cbs_publisher_instance;
			if (doNotClearContent !== true) {
				publisher = new CBSPublisher(items, dataWidget, wgt_placeolder_id, inPopup, periodTitleSelected);
			}
			else if (doNotClearContent === true) {
				publisher.init(items, dataWidget, wgt_placeolder_id, inPopup, periodTitleSelected);
			}
			publisher.doNotClearContent = doNotClearContent;
			
			var parseContinue = true;
			var parseIndex = 0;
			var loopIndex = 0;
			var loopLimit = 2000;
			
			while (parseContinue) {
				loopIndex++;
				parseIndex = publisher.parseItem( items[parseIndex], parseIndex );
				if ( parseIndex >= items.length || loopIndex > loopLimit ) {
					parseContinue = false;
				}
			}
			publisher.gridColumns.push( {header: "", dataIndex: "caction", width: 30} );
			publisher.gridFields_level_1.push( {name: "caction"} );
			
			if (doNotClearContent === true) {
				publisher.refreshReport();
			}
			else {
				var reportItems = publisher.renderReport();
				
				if (popupCallback)
					popupCallback(reportItems, publisher);	
			}
		}
	});
}

function CBSPublisher(items, dataWidget, wgt_placeolder_id, inPopup, periodTitleSelected) {
	this.init(items, dataWidget, wgt_placeolder_id, inPopup, periodTitleSelected);
	return this;
}

CBSPublisher.prototype.init=function(items, dataWidget, wgt_placeolder_id, inPopup, periodTitleSelected) {
	// general data
	this.items = items;
	this.dataWidget = dataWidget;
	this.wgt_placeolder_id = wgt_placeolder_id;
	this.inPopup = inPopup;
	this.doNotClearContent = false;
	
	// zero level
	this.error = new Object();
	this.normalFormLevel_0 = new Array();// Array of {label, data}
	this.collapsedFormLevel_0 = new Array();// Array of {label, data}
	
	// first level - grid
	this.reportName = null;
	this.isItTree = false;
	this.gridColumns = new Array();
	this.gridFields_level_1 = new Array();
	this.gridData_level_1 = new Array();
	
	// first level - dimension links
	this.dimensionLinks = new Array();
	this.periodTitleSelected = periodTitleSelected;
	
	// first level - charts
	this.chartsLevel_0 = new Object();
	this.chartsLevel_0.reportName = null;
	/*
	Dynamically created properties:
		this.chartsLevel_0.chart_[parentIndex].[chartName].pie: Boolean (true = pie, false = line)
		this.chartsLevel_0.chart_[parentIndex].[chartName].label: String
		this.chartsLevel_0.chart_[parentIndex].[chartName].graphType: String
		this.chartsLevel_0.chart_[parentIndex].[chartName].series: Array of {c01, c02, c03}
		
		chartName - PA, PB..., LA, LB...
	*/
	
	// second level - charts
	this.chartsLevel_1 = new Object();
	this.chartsLevel_1.reportName = null;
	
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
	this.chartsPanelId = "chartsPanel";
}

CBSPublisher.prototype.type="CBSPublisher";

CBSPublisher.prototype.parseItem=function( item, index ) {
	var nextIndex = index+1;
	
	// function to add the data for the "popup icon" - used later when parsing...
	var buildPopupLink = function(item, row) {
		if (item.c19 || item.c20) {
			var firstPopupIcon = item.c19;
			var secondPopupIcon = item.c20;
			
			var addPopupIcon = function(popupIconDef) {
				if (popupIconDef == undefined || popupIconDef == null)
					return;
				
				var wsParamsArray = popupIconDef.split(';');
				
				if (row.caction == undefined || row.caction == null) {
					row.caction = "";
				}
				row.caction = row.caction + "<img src=\"http://88.191.129.143/RestFixture/images/" + wsParamsArray[0] + ".png\" title=\"" + wsParamsArray[1] +
					"\" onclick=\"javascript:cbsWidgetPublisherInPopup('" + popupIconDef + "')\"/>";
			};
			
			if (firstPopupIcon !== undefined)
				addPopupIcon(firstPopupIcon);
			
			if (secondPopupIcon !== undefined)
				addPopupIcon(secondPopupIcon);
		}
	};
	
	// there is an ERROR
	if ( item.dimName === "-E" ) {
		this.error.exists = true;
		this.error.code = item.c01;
		this.error.description = item.c02;
		this.error.explanation = item.c03;
	}
	// ZERO LEVEL - General forms
	else if ( item.dimName === "0" ) {
		this.normalFormLevel_0.push({ label: item.c02, data: item.c03 });
	}
	else if ( item.dimName === "-6" ) {
		this.collapsedFormLevel_0.push({ label: item.c02, data: item.c03 });
	}
	// FIRST LEVEL - Main Grid
	else if ( item.dimName === "CR" ) {
		this.setReportName( item.c01 );
		
		this.isItTree = (item.c13 == 'N') ? true : false;// is it Tree?
		
		// ID column - used to map the first & second levels
		this.gridColumns.push( {header: "row_id", dataIndex: "row_id", hidden: true} );
		this.gridFields_level_1.push( {name: "row_id"} );
		
		// add a column for the tooltip
		this.gridColumns.push( {header: "Long Description", dataIndex: "long_descr", hidden: true} );
		this.gridFields_level_1.push( {name: "long_descr"} );
		
		// add or not the icon column
		if ( item.c04 === 'Y' ) {
			this.gridColumns.push( {header: "", dataIndex: "rep_icon", width: 30} );
			this.gridFields_level_1.push( {name: "rep_icon"} );
		}
	}
	else if ( item.dimName === "CT" ) {
		var colIndex = this.gridFields_level_1.length - 1;// minus 1, because we always have 2 columns: row_id & long_descr
		if (this.gridColumns[2] !== undefined && this.gridColumns[2].dataIndex === 'rep_icon')// there is already rep_icon column
			colIndex = colIndex - 1;
		
		// renderer to display the Tool-tip
		var columnRenderer = function(value, meta, record) {
            meta.tdAttr = 'data-qtip="' + record.data.long_descr + '"';
            return value;
        };
        
		if (colIndex === 2)// TODO: find the column size dynamically
			this.gridColumns.push( {header: item.c02, dataIndex: "c"+colIndex, flex: 1, renderer: columnRenderer} );
		else
			this.gridColumns.push( {header: item.c02, dataIndex: "c"+colIndex, renderer: columnRenderer} );
			
		this.gridFields_level_1.push( {name: "c"+colIndex} );	
	}
	else if ( item.dimName === "-0" ) {// dimension links
		// preparing the WS parameters JSON object
		var wsParamsJsonObj = new Object();
		
		wsParamsJsonObj.usr = cbsPublisherSettings.usr;
		wsParamsJsonObj.lng = cbsPublisherSettings.lng;
		wsParamsJsonObj.roles = cbsPublisherSettings.roles;
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
	else if (item.dimName === "1" || item.dimName === "2" || item.dimName === "3") {
		var row = new Object();
		row.row_id = item.id;
		
		// main data columns
		for (var i=1; i<this.gridFields_level_1.length; i++) {
			row["c"+i] = (i<10) ? item["c0"+i] : item["c"+i];
			if (i == 1 && item.dimName == "2")
				row["c"+i] = "=> " + row["c"+i];
			else if (i == 1 && item.dimName == "3")
				row["c"+i] = "==> " + row["c"+i];
		}
		
		// add a data to the search details column
		if ( this.items[index+1] ) {
			if ((this.items[index+1].dimName.indexOf("1") === 0 || this.items[index+1].dimName.indexOf("2") === 0 || this.items[index+1].dimName.indexOf("3") === 0)
					&& this.items[index+1].dimName.length > 1)
				row.caction = "<img src=\"images/studio/bullet/dfs_search_sel.png\" />";
		} else {
			row.caction="";
		}
		
		// add a data to the icon column
		if (this.gridColumns[2] !== undefined && this.gridColumns[2].dataIndex === 'rep_icon') {
			row.rep_icon = "<img src=\"http://88.191.129.143/RestFixture/images/" + item.img + ".png\" />";
		}
		
		row.long_descr = item.c16;// add a data to the tooltip column
		
		buildPopupLink(item, row);// add the data for the "popup icon"
		
		this.gridData_level_1.push( row );// add the row to the grid
		
		this.lastParentIndex = row.row_id;// last possible parent for the second level rows
	}
	// FIRST & SECOND LEVELS - Charts
	else if ( item.dimName === "D09" ) {
		this.chartsLevel_0.reportName = item.c01;
	}
	else if ( item.dimName === "D19" ) {
		this.chartsLevel_1.reportName = item.c01;
	}
	else if (item.dimName === "09" || item.dimName === "19") {
		var levelIdx = item.dimName.substring(0, 1);
		var parentIndex = (levelIdx === "0") ? 0 : this.lastParentIndex;
		
		if (this["chartsLevel_" + levelIdx]["chart_" + parentIndex] == undefined)
			this["chartsLevel_" + levelIdx]["chart_" + parentIndex] = new Object();
		
		if (this["chartsLevel_" + levelIdx]["chart_" + parentIndex]["chart_" + item.c05] == undefined)
			this["chartsLevel_" + levelIdx]["chart_" + parentIndex]["chart_" + item.c05] = new Object();
		
		var currentChart = this["chartsLevel_" + levelIdx]["chart_" + parentIndex]["chart_" + item.c05];
		
		if (item.c05.indexOf("P") === 0)
			currentChart.pie = true;
		else
			currentChart.pie = false;
		
		if (item.c01 === "label")
			currentChart.label = item.c02;
		else if (item.c01 === "graphType")
			currentChart.graphType = item.c02;
		else {
			if (currentChart.series == undefined)
				currentChart.series = new Array();

			currentChart.series.push({ c01: item.c01, c02: item.c02, c03: item.c03 });
		}
	}
	// SECOND LEVEL - Tabs
	else if ( item.dimName.indexOf("D") === 0 ) {
		//this.isThereDetails = true;
		var tab_idx = item.dimName.substring(1, 3);
		this.gridsOrFormsLevel_2["reportName_" + tab_idx] = item.c01;
	}
	else if ( item.dimName.indexOf("C") === 0 ) {
		var tab_idx = item.dimName.substring(1, 3);
		
		if (this.gridsOrFormsLevel_2["gridColumns_" + tab_idx] == undefined) {
			this.gridsOrFormsLevel_2["gridColumns_" + tab_idx] = new Array();
			this.gridsOrFormsLevel_2["gridFields_" + tab_idx] = new Array();
		}
		
		var colIndex = this.gridsOrFormsLevel_2["gridColumns_" + tab_idx].length;
		this.gridsOrFormsLevel_2["gridColumns_" + tab_idx].push( {header: item.c02, dataIndex: "c"+(colIndex+1)} );
		this.gridsOrFormsLevel_2["gridFields_" + tab_idx].push( {name: "c"+(colIndex+1)} );
	}
	else if ((item.dimName.indexOf("1") === 0  || item.dimName.indexOf("2") || item.dimName.indexOf("3")) && item.dimName.length > 1) {
		var tab_idx = item.dimName;
		
		if (this.gridsOrFormsLevel_2["gridFields_" + tab_idx]) {// if it was defined, it's a table data
			var row = new Object();
			for (var i = 1; i < (this.gridsOrFormsLevel_2["gridFields_" + tab_idx].length + 1); i++) {
				row["c"+i] = (i < 10) ? item["c0"+i] : item["c"+i];
			}
			
			if (this.gridsOrFormsLevel_2["gridData_" + tab_idx] == undefined)
				this.gridsOrFormsLevel_2["gridData_" + tab_idx] = new Array();
			
			// add a column for the "popup icon"
			var doesCactionExist = false;
			for (var i = 0; i < this.gridsOrFormsLevel_2["gridFields_" + tab_idx].length; i++) {
				if (this.gridsOrFormsLevel_2["gridFields_" + tab_idx][i].name == "caction")
					doesCactionExist = true;
			}
			if (doesCactionExist == false) {
				this.gridsOrFormsLevel_2["gridColumns_" + tab_idx].push( {header: "", dataIndex: "caction", width: 30} );
				this.gridsOrFormsLevel_2["gridFields_" + tab_idx].push( {name: "caction"} );
			}
			
			buildPopupLink(item, row);// add the data for the "popup icon"
				
			this.gridsOrFormsLevel_2["gridData_" + tab_idx].push({ parentIndex: this.lastParentIndex, row: row });
		}
		else {// it's a form data
			if (this.gridsOrFormsLevel_2["formData_" + tab_idx] == undefined)
				this.gridsOrFormsLevel_2["formData_" + tab_idx] = new Array();
			
			this.gridsOrFormsLevel_2["formData_" + tab_idx].push({ parentIndex: this.lastParentIndex, label: item.c02, data: item.c03 });
		}
	}
	
	return nextIndex;
}

CBSPublisher.prototype.setReportName=function( name ) {
	this.reportName = name;
}

CBSPublisher.prototype.renderReport=function() {
	console.log(this);
	var cbsPublisher_instance = this;
	var items = new Array();
	
	// zero level - normal form
	if (this.normalFormLevel_0.length > 0) {
		var html = "<table style='font-size:12px;' width='100%'><tr>";// put data in 1 row
		for (var i = 0; i < this.normalFormLevel_0.length; i++) {
			html = html + "<td width='15%'>" + this.normalFormLevel_0[i].label + ": </td><td><b>" + this.normalFormLevel_0[i].data + "</b></td>";
		}
		html += "</tr></table>";
		
		items.push({
			border: false,
			html: html
		});
		
		items.push({ xtype: "splitter" });// splitter between the levels
	}
	
	// zero level - collapsed form
	if (this.collapsedFormLevel_0.length > 0) {
		var html = "<table style='font-size:12px;' width='100%'>";// put data in several rows, 2 columns
		for (var i = 0; i < this.collapsedFormLevel_0.length; i++) {
			html = html + "<tr><td>" + this.collapsedFormLevel_0[i].label + "</td><td><b>" + this.collapsedFormLevel_0[i].data + "</b></td>";
			
			if ((i + 1) < this.collapsedFormLevel_0.length)
				html = html + "<td>" + this.collapsedFormLevel_0[++i].label + "</td><td><b>" + this.collapsedFormLevel_0[i].data + "</b></td></tr>";
			else
				html = html + "</tr>";
		}
		html += "</tr></table>";
		
		items.push({
			xtype: 'fieldset',
			collapsible: true,
			collapsed: true,// initially collapsed
			html: html
		});
		
		items.push({ xtype: "splitter" });// splitter between the levels
	}
	
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

		items.push({
			itemId: "cbsPeriodDimensions",
			maxWidth: 300,
			xtype: 'combobox',
		    fieldLabel: 'Period',
		    store: dimensionDataStore,
		    queryMode: 'local',
		    displayField: 'dimTitle',
		    valueField: 'wsParams',
		    listeners: {
		    	select: function(combo, records, eOpts) {
		    		cbsWidgetPublisher(cbsPublisher_instance.dataWidget, false, records[0].data.wsParams, null, records[0].data.dimTitle, true, cbsPublisher_instance);
		    	} 
		    }
		});
	}
	
	// display error message box
	if (this.error.exists == true) {
		items.push({
			itemId: "cbsPublisherErrorMessage",
			border: false,
			html: this.buildErrorMessageBox()
		});
		
		items.push({ xtype: "splitter" });// splitter between the levels
	}
	
	// first level - grid:
	// 1) rearrange the icon column position: it must always be the second visible column
	if (this.gridColumns[2] !== undefined && this.gridColumns[2].dataIndex === 'rep_icon') {
		var iconCol = this.gridColumns[2];
		this.gridColumns[2] = this.gridColumns[3];
		this.gridColumns[3] = iconCol;
	}
	// 2) create and add a grid item
	items.push({
		xtype: "grid",
		itemId: "cbsPublisherMainGrid",
    	columns: this.gridColumns,
	    store: Ext.create("Ext.data.Store", { fields: this.gridFields_level_1, data: this.gridData_level_1 }),
    	flex: 1,
    	listeners: {
	    	itemclick: function(grid, record, item, index, e) {
	    		cbsPublisher_instance.renderTab(record.get('row_id'), this, this.ownerCt);// second level - tabs
	    	}
    	}
	});
	
	// first level - charts
	var charts = this.buildCharts(0, 0);
	var chartPanel = null;
	if (charts.length > 0) {
		var chartItems = new Array();
		for (var i = 0; i < charts.length; i++) {
			chartItems.push( charts[i] );
		}
		
		var chartsPanelDef = {
	    	itemId: this.chartsPanelId,
		    bodyPadding: 5,
	    	flex: 1,
	    	autoScroll: true,
	    	items: chartItems,
	    	layout: {
	    	    type: "hbox"
	    	},
		};
		items.push({ xtype: "splitter" });// splitter between the levels
		items.push(chartsPanelDef);
	}
	
	if (this.inPopup == false) {// main panel
		this.reportPanel = Ext.create('Ext.panel.Panel', {
			title: this.reportName,
	    	width: 1100,
		    height: 800,
	    	renderTo: this.wgt_placeolder_id,
		    layout: {
	    	    type: "vbox",
	        	align: "stretch",
		        padding: 10
	    	},
		    items: items
		});
	} else {// just return items - they will be used later to display in modal window
		return items;
	}
}

CBSPublisher.prototype.refreshReport=function() {
	console.log(this);
	var cbsPublisher_instance = this;
	
	// select the dimension link if the report was reloaded
	if (this.dimensionLinks.length > 0) {
		var dimensionsCombo = this.reportPanel.getComponent("cbsPeriodDimensions");
		dimensionsCombo.setValue( this.periodTitleSelected );
	}
	
	// treat error message
	if (this.error.exists == true) {
		var errorMessageBox = this.reportPanel.getComponent("cbsPublisherErrorMessage");
		if (errorMessageBox !== undefined) {
			errorMessageBox.update( this.buildErrorMessageBox() );
		} else {
			this.reportPanel.add({
				itemId: "cbsPublisherErrorMessage",
				border: false,
				html: this.buildErrorMessageBox()
			});
		}
		
		// hide all other components except dimention links and error message
		for (var i = 0; i < this.reportPanel.items.length; i++) {
			var comp = this.reportPanel.items.getAt(i);
			var compItemId = comp.getItemId();
			if (compItemId !== "cbsPeriodDimensions" && compItemId !== "cbsPublisherErrorMessage") {
				comp.hide();
			}
		}
	} else {
		// show all components except error message
		for (var i = 0; i < this.reportPanel.items.length; i++) {
			var comp = this.reportPanel.items.getAt(i);
			var compItemId = comp.getItemId();
			if (compItemId === "cbsPublisherErrorMessage") {
				comp.hide();
			} else {
				comp.show();
			}
		}
	}
	
	// reload the grid with new data
	var mainGrid = this.reportPanel.getComponent("cbsPublisherMainGrid");
	var newStore = Ext.create("Ext.data.Store", { fields: this.gridFields_level_1, data: this.gridData_level_1 });
	mainGrid.reconfigure(newStore);
}

/*
 * Create Tab with second level nested grids. Must be invoked clicking on the row in the first level grid.
 */
CBSPublisher.prototype.renderTab=function(parentIndex, firstLevelGrid, container) {
	var cbsPublisher_instance = this;
	
	var buildTabs = function(treeIndex, cbsPublisher_instance) {
		var tabIndex = 0;
		
		if (cbsPublisher_instance.gridsOrFormsLevel_2["reportName_" + treeIndex + tabIndex]) {
			var parseContinue = true;
			var items = new Array();
			
			// tabs: grids & forms
			while (parseContinue) {
				if (cbsPublisher_instance.gridsOrFormsLevel_2["reportName_" + treeIndex + tabIndex]) {
					if (cbsPublisher_instance.gridsOrFormsLevel_2["gridData_" + treeIndex + tabIndex]) {// if it was defined, it's a table data
						var gridData = new Array();
						var currTabAllData = cbsPublisher_instance.gridsOrFormsLevel_2["gridData_" + treeIndex + tabIndex];
						for (var i = 0; i < currTabAllData.length + 1; i++) {
							if (currTabAllData[i] && (currTabAllData[i].parentIndex == parentIndex))
								gridData.push( currTabAllData[i].row );
						}
						
						if (gridData.length > 0) {
							var item = {
								title: cbsPublisher_instance.gridsOrFormsLevel_2["reportName_" + treeIndex + tabIndex],
								forceFit: true,
			        			xtype: "grid",
			        			columns: cbsPublisher_instance.gridsOrFormsLevel_2["gridColumns_" + treeIndex + tabIndex],
			        			store: Ext.create("Ext.data.Store", { fields: cbsPublisher_instance.gridsOrFormsLevel_2["gridFields_" + treeIndex + tabIndex], data: gridData })
				    		};
							items.push(item);
						}
					}
					else {// it's a form data
						var html = "<table style='font-size:12px;' width='100%'>";// put data in several rows, 2 columns
						var currTabAllData = cbsPublisher_instance.gridsOrFormsLevel_2["formData_1" + tabIndex];
						for (var i = 0; i < currTabAllData.length; i++) {
							if (currTabAllData[i] && (currTabAllData[i].parentIndex == parentIndex)) {
								html = html + "<tr><td style='padding:3px'>" + currTabAllData[i].label + "</td><td><b>" + currTabAllData[i].data + "</b></td>";
								
								if ((i + 1) < currTabAllData.length)
									html = html + "<td>" + currTabAllData[++i].label + "</td><td><b>" + currTabAllData[i].data + "</b></td></tr>";
								else
									html = html + "</tr>";
							}
						}
						html += "</table>";
						
						var item = {
							title: cbsPublisher_instance.gridsOrFormsLevel_2["reportName_" + treeIndex + tabIndex],
							html: html
			    		};
						items.push(item);
					}
				}
				else
					parseContinue = false;
				
				tabIndex++;
			}
			
			// second level charts
			var charts = cbsPublisher_instance.buildCharts(1, parentIndex);
			if (charts.length > 0) {
				var chartsContainer = container.getComponent(cbsPublisher_instance.chartsPanelId);
				
				// first, remove the old second level charts
				for (var i = 0; i < chartsContainer.items.length; i++) {
					var oldChart = chartsContainer.getComponent( cbsPublisher_instance.createChartId(1, i) );
					if (oldChart)
						chartsContainer.remove(oldChart);
				}
				
				// and now, add new second level charts
				for (var i = 0; i < charts.length; i++) {
					chartsContainer.add( charts[i] );
				}
				
				chartsContainer.doLayout();
			}
			
			// build the Tab container
			var tabsId = "secondLevelTab";
			var tabsSplitterId = "secondLevelTabSplitter";
			var newTabs = null;
			
			if (items.length > 0) {
				newTabs = Ext.create('Ext.tab.Panel', {// tabs
					itemId: tabsId,
					bodyPadding: 10,
					flex: 1,
					plain: true,
					items: items
				});
			}
			
			// remove previous tabs if exists
			if ( container.getComponent(tabsId) ) {
				container.remove( container.getComponent(tabsSplitterId) );
				container.remove( container.getComponent(tabsId) );
			}
			
			// add new tabs
			if (newTabs !== null) {
				container.add(newTabs);

				//splitter cannot be the last component - insert it before the tabsx
				container.insert(container.items.length - 1, Ext.create('Ext.resizer.Splitter', {itemId: tabsSplitterId}));
			}		
			container.doLayout();
			
			// scroll to selected row in the first level grid
			var lastSelectedRow = firstLevelGrid.getSelectionModel().getLastSelected().index;
			firstLevelGrid.getView().focusRow( lastSelectedRow );
		}
	}
	
	// only 3 levels of the Tree could exist
	buildTabs(1, cbsPublisher_instance);
	buildTabs(2, cbsPublisher_instance);
	buildTabs(3, cbsPublisher_instance);
}

CBSPublisher.prototype.buildCharts=function(levelIndex, parentIndex) {
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
				else {//line chart
					var lineChart = this.buildLineChart(chartDef);
					charts.push(lineChart);
				}
			}
		}
	}
	
	return charts;
}

CBSPublisher.prototype.createChartId=function(levelIndex, indexWithinLevel) {
	return 'cbsChart_' + levelIndex + '_' + indexWithinLevel;
}

CBSPublisher.prototype.buildPieChart=function(chartDef) {
	var data = new Array();
	for (var i = 0; i < chartDef.series.length; i++) {
		data.push({ 'name': chartDef.series[i].c02, 'data': parseInt(chartDef.series[i].c03) });
	}
	
	var store = Ext.create('Ext.data.JsonStore', {
	    fields: ['name', 'data'],
	    data: data
	});
	
	var pieChart = Ext.create('Ext.chart.Chart', {
		itemId: chartDef.itemId,
		width: 200,   height: 170,  animate: true, insetPadding: 25, 
	    store: store, theme: 'Base:gradients', shadow: true,
	    legend: { position: 'bottom' },
	    series: [{
	    	//title: 'aaa',
	        type: 'pie', angleField: 'data', showInLegend: true, 
	        tips: {
	            trackMouse: true,  width: 200, height: 28,
	            renderer: function(storeItem) {// calculate and display percentage on hover
	                var total = 0;
	                store.each(function(rec) { total += rec.get('data'); });
	                this.setTitle(storeItem.get('name') + ': ' + Math.round(storeItem.get('data') / total * 100) + '%');
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
	                return Math.round(storeItem / total * 100) + '%';
	            }
	        }
	    }]
	});
	
	return pieChart;
}

CBSPublisher.prototype.buildLineChart=function(chartDef) {
	var fields = new Array();
	var fieldsVertAxe = new Array();
	var data = new Array();
	var axes = new Array();
	var series = new Array();
	
	fields.push('name');
	
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
	
	axes.push({ type: 'Numeric', position: 'left', fields: fieldsVertAxe, label: {renderer: Ext.util.Format.numberRenderer('0,0')}, grid: true, hidden: false });
	if (chartDef.graphType === 'date')
		axes.push({ type: 'Time', dateFormat: 'Y M d', position: 'bottom', fields: ['name'], grid: false, hidden: false, label: {rotate: {degrees: 315}} });
	else if (chartDef.graphType === 'number')
		axes.push({ type: 'Numeric', position: 'bottom', fields: ['name'], grid: true, hidden: false });
	
	var store = Ext.create('Ext.data.JsonStore', {
		fields: fields,
	    data: data
	});
	
	var lineChart = Ext.create('Ext.chart.Chart', {
		itemId: chartDef.itemId,
		xtype: 'chart',
		style: 'background:#fff',
	    width: 200, height: 170,
	    legend: { position: 'bottom' },
	    animate: true,
	    store: store,
	    axes: axes,
	    series: series
	});
	
	return lineChart;
}

CBSPublisher.prototype.buildErrorMessageBox=function() {
	/*var sHTML = '<div id="8479143332_div3" class="gc_error_box" style="display: block;">' +
		'<img elementid="8479143332_img" src="images/icon/bt_close.gif" class="gc_close_button" style="display: none;">' +
		'<b>Code:</b> ' + this.error.code +
		'<div elementid="8479143332_once" style="display: block;">' +
		'<b>Description:</b> ' + this.error.description +
		'</div>' +
		'<div elementid="8479143332_once" style="display: block;">' +
		'<b>Explanation:</b> ' + this.error.explanation +
		'</div>' +
		'</div>';*/
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

/*
 * Displays the widget content in popup window calling WS with dynamically defined parameters.
 */
function cbsWidgetPublisherInPopup(wsParamsAsString) {
	// preparing the WS parameters JSON object
	var wsParamsJsonObj = new Object();
	var wsParamsArray = wsParamsAsString.split(';');
	
	wsParamsJsonObj.usr = cbsPublisherSettings.usr;
	wsParamsJsonObj.lng = cbsPublisherSettings.lng;
	wsParamsJsonObj.roles = cbsPublisherSettings.roles;
	wsParamsJsonObj.sheetname = wsParamsArray[2];
	wsParamsJsonObj.client = wsParamsArray[3];
	//var report = wsParamsArray[4];// for the future - to say that this is a publisher report
	
	// parameters 'p1'...'p5'
	for (var i = 5; i < wsParamsArray.length; i++) {
		wsParamsJsonObj["p" + (i-4)] = wsParamsArray[i];
	}
	
	// dispaly popup window in the callback function that will be called by the DataQuery after getting the WS data
	var popupCallback = function(reportItems, cbsPublisher_instance) {
		$("body").append("<style type=\"text/css\">" +
				".whitePopup .x-window-body {" +
					"background-color: white;" +
				"}" +
			"</style>");
		
		var popupWindow = Ext.create('Ext.window.Window', {
			title: cbsPublisher_instance.reportName,
		    modal: true,
		    width: 900,
		    height: 750,
		    cls:'whitePopup',
		    layout: {
	    	    type: "vbox",
	        	align: "stretch",
		        padding: 10
	    	},
		    items: reportItems
		}).show();
		
		cbsPublisher_instance.reportPanel = popupWindow;
	};
	
	// execute DataQuery
	var reportItems = cbsPublisherDataQueryExecute(cbsPublisherSettings.dataWidget, null, true, wsParamsJsonObj, popupCallback, null, false, null);
}