/*
	Widget Publisher
	(c) 2013 - Capital Banking Solutions
*/

/*
 * Notes:
 * 1) Rows number is never more than 2000. So, it's useless to implement 'paging' mechanism for the performance.
 * 2) Probably, it makes sense to add a 'PagingToolbar' but anyway, all the data are downloading in one request. 
 */

function cbsWidgetPublisher( dataWidget ) {
	dataWidget.clearContent();
	var wgt_placeolder_id = Math.uuid( 10,10 );
	dataWidget.addContent( "<div id=\"" + wgt_placeolder_id + "\" style=\"width:100%;height:auto;\"></div>" );
	
	var dq = new DataQuery( "TestPublisher" );
	dq.execute( null, function(dataSet) {
		var buffer = dataSet.getData();
		if ( buffer !== null && buffer["coResultVal"] !== null ) {
			var items = buffer[0].coResultVal;
			var publisher = new CBSPublisher(items, dataWidget, wgt_placeolder_id);
			
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
			publisher.renderReport();
		}
	});
	
}

function CBSPublisher(items, dataWidget, wgt_placeolder_id) {
	// general data
	this.items = items;
	this.dataWidget = dataWidget;
	this.wgt_placeolder_id = wgt_placeolder_id;
	
	// zero level
	this.normalFormLevel_0 = new Array();// Array of {label, data}
	this.collapsedFormLevel_0 = new Array();// Array of {label, data}
	
	// first level - grid
	this.reportName = null;
	this.gridColumns = new Array();
	this.gridFields_level_1 = new Array();
	this.gridData_level_1 = new Array();
	
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
		this.gridsOrFormsLevel_2.gridData_10: Array of {parentIndex, row}, where parentIndex = first level table row index
		this.gridsOrFormsLevel_2.formData_10: Array of {parentIndex, label, data}
		
		this.gridsOrFormsLevel_2.reportName_11, 12, 13... etc.
		
		TODO: use item.id as parentIndex, this id must be added as a hidden column in first level table
	*/
	
	// temporary variable mapping the second and first levels data
	this.lastParentIndex = 0;
	
	// initial blank panel for the second level
	this.initialDetailsPanelId = "blankPanel";
	this.initialDetailsPanelDef = {
    	itemId: this.initialDetailsPanelId,
    	title: "Details",
	    bodyPadding: 5,
    	flex: 1
	};
	
	// charts panel id
	this.chartsPanelId = "chartsPanel";
	
	return this;
}

CBSPublisher.prototype.type="CBSPublisher";

CBSPublisher.prototype.parseItem=function( item, index ) {
	var nextIndex = index+1;
	
	// ZERO LEVEL - General forms
	if ( item.dimName === "0" ) {
		this.normalFormLevel_0.push({ label: item.c02, data: item.c03 });
	}
	else if ( item.dimName === "-6" ) {
		this.collapsedFormLevel_0.push({ label: item.c02, data: item.c03 });
	}
	// FIRST LEVEL - Main Grid
	else if ( item.dimName === "CR" ) {
		this.setReportName( item.c01 );
	}
	else if ( item.dimName === "CT" ) {
		var colIndex = this.gridFields_level_1.length;
		
		if (colIndex == 1)// TODO: find the column size dynamically
			this.gridColumns.push( {header: item.c02, dataIndex: "c"+(colIndex+1), flex: 1} );
		else
			this.gridColumns.push( {header: item.c02, dataIndex: "c"+(colIndex+1)} );
			
		this.gridFields_level_1.push( {name: "c"+(colIndex+1)} );
	}
	else if ( item.dimName === "1" ) {
		var row = new Object();
		for (var i=1; i<(this.gridFields_level_1.length+1); i++) {
			row["c"+i] = (i<10) ? item["c0"+i] : item["c"+i];
		}
		if (this.items[index+1].dimName.indexOf("1") === 0 && this.items[index+1].dimName.length > 1 ) {
			row.caction = "<img src=\"images/studio/bullet/dfs_search_sel.png\" />";
		} else {
			row.caction="";
		}
		this.gridData_level_1.push( row );
		
		this.lastParentIndex = this.gridData_level_1.length - 1;// last possible parent for the second level rows - TODO: must be item.id
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
	else if ( item.dimName.indexOf("D1") === 0 ) {
		var tab_idx = item.dimName.substring(1, 3);
		this.gridsOrFormsLevel_2["reportName_" + tab_idx] = item.c01;
	}
	else if ( item.dimName.indexOf("C1") === 0 ) {
		var tab_idx = item.dimName.substring(1, 3);
		
		if (this.gridsOrFormsLevel_2["gridColumns_" + tab_idx] == undefined) {
			this.gridsOrFormsLevel_2["gridColumns_" + tab_idx] = new Array();
			this.gridsOrFormsLevel_2["gridFields_" + tab_idx] = new Array();
		}
		
		var colIndex = this.gridsOrFormsLevel_2["gridColumns_" + tab_idx].length;
		this.gridsOrFormsLevel_2["gridColumns_" + tab_idx].push( {header: item.c02, dataIndex: "c"+(colIndex+1)} );
		this.gridsOrFormsLevel_2["gridFields_" + tab_idx].push( {name: "c"+(colIndex+1)} );
	}
	else if (item.dimName.indexOf("1") === 0 && item.dimName.length > 1) {
		var tab_idx = item.dimName;
		
		if (this.gridsOrFormsLevel_2["gridFields_" + tab_idx]) {// if it was defined, it's a table data
			var row = new Object();
			for (var i = 1; i < (this.gridsOrFormsLevel_2["gridFields_" + tab_idx].length + 1); i++) {
				row["c"+i] = (i < 10) ? item["c0"+i] : item["c"+i];
			}
			
			if (this.gridsOrFormsLevel_2["gridData_" + tab_idx] == undefined)
				this.gridsOrFormsLevel_2["gridData_" + tab_idx] = new Array();
				
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
	
	// zero level normal form
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
	
	// zero level collapsed form
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
	
	// creation of the first level grid
	items.push({
		xtype: "grid",
    	columns: this.gridColumns,
	    store: Ext.create("Ext.data.Store", { fields: this.gridFields_level_1, data: this.gridData_level_1 }),
    	flex: 1,
    	listeners: {
	    	itemclick: function(grid, record, item, index, e) {
	    		cbsPublisher_instance.renderTab(index, this, this.ownerCt);
	    	}
    	}
	});
	
	items.push({ xtype: "splitter" });// splitter between the levels
	
	// first level charts
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
	    	autoScroll: true,//overflowX: "auto", overflowY: "auto",
	    	items: chartItems,
	    	layout: {
	    	    type: "hbox"/*,
	        	align: "stretch"*/
	    	},
		};
		items.push(chartsPanelDef);
	}
	
	items.push({ xtype: "splitter" });// splitter between the levels
	items.push( this.initialDetailsPanelDef );// initial blank panel for the second level
	
	// main panel
	var reportPanel = Ext.create('Ext.panel.Panel', {
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
}

/*
 * Create Tab with second level nested grids. Must be invoked clicking on the row in the first level grid.
 */
CBSPublisher.prototype.renderTab=function(parentIndex, firstLevelGrid, container) {
	var tabIndex = 0;
	
	if (this.gridsOrFormsLevel_2["reportName_1" + tabIndex]) {
		var parseContinue = true;
		var items = new Array();
		
		// tabs: grids & forms
		while (parseContinue) {
			if (this.gridsOrFormsLevel_2["reportName_1" + tabIndex]) {
				if (this.gridsOrFormsLevel_2["gridData_1" + tabIndex]) {// if it was defined, it's a table data
					var gridData = new Array();
					var currTabAllData = this.gridsOrFormsLevel_2["gridData_1" + tabIndex];
					for (var i = 0; i < currTabAllData.length + 1; i++) {
						if (currTabAllData[i] && (currTabAllData[i].parentIndex == parentIndex))
							gridData.push( currTabAllData[i].row );
					}
					
					if (gridData.length > 0) {
						var item = {
							title: this.gridsOrFormsLevel_2["reportName_1" + tabIndex],
							forceFit: true,
		        			xtype: "grid",
		        			columns: this.gridsOrFormsLevel_2["gridColumns_1" + tabIndex],
		        			store: Ext.create("Ext.data.Store", { fields: this.gridsOrFormsLevel_2["gridFields_1" + tabIndex], data: gridData })
			    		};
						items.push(item);
					}
				}
				else {// it's a form data
					var html = "<table style='font-size:12px;' width='100%'>";// put data in several rows, 2 columns
					var currTabAllData = this.gridsOrFormsLevel_2["formData_1" + tabIndex];
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
						title: this.gridsOrFormsLevel_2["reportName_1" + tabIndex],
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
		var charts = this.buildCharts(1, parentIndex);
		if (charts.length > 0) {
			var chartsContainer = container.getComponent(this.chartsPanelId);
			
			// first, remove the old second level charts
			for (var i = 0; i < chartsContainer.items.length; i++) {
				var oldChart = chartsContainer.getComponent( this.createChartId(1, i) );
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
		var container_level_2 = null;
		
		if (items.length > 0) {
			container_level_2 = Ext.create('Ext.tab.Panel', {// tabs
				itemId: tabsId,
				bodyPadding: 10,
				flex: 1,
				plain: true,
				items: items
			});
		}
		else {
			container_level_2 = Ext.create('Ext.panel.Panel', this.initialDetailsPanelDef);// initial blank panel
		}
		
		// remove initial blank panel if exists
		if ( container.getComponent(this.initialDetailsPanelId) )
			container.remove( container.getComponent(this.initialDetailsPanelId) );
		
		// remove previous tabs if exists
		if ( container.getComponent(tabsId) )
			container.remove( container.getComponent(tabsId) );
		
		// add new tabs or initial blank panel
		container.add(container_level_2);
		container.doLayout();
		
		// scroll to selected row in the first level grid
		var lastSelectedRow = firstLevelGrid.getSelectionModel().getLastSelected().index;
		firstLevelGrid.getView().focusRow( lastSelectedRow );
	}
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
	        type: 'pie', angleField: 'data', showInLegend: true, 
	        tips: {
	            trackMouse: true,  width: 200, height: 28,
	            renderer: function(storeItem, item) {// calculate and display percentage on hover
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
	        	renderer: function(storeItem, item) {// calculate percentage
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