/*
 * Copyright 2012 LinkedIn Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

$.namespace('azkaban');

var flowExecuteDialogView;
azkaban.FlowExecuteDialogView = Backbone.View.extend({
  events: {
    "click .closeExecPanel": "hideExecutionOptionPanel",
    "click #schedule-btn": "scheduleClick",
    "click #execute-btn": "handleExecuteFlow",
    "keyup input": "filterJobs",
    "click li.listElement": "handleJobClick",
    "click #close-btn2": "handleClose"
  },

  initialize: function (settings) {
    this.model.bind('change:flowinfo', this.changeFlowInfo, this);
    this.model.bind('change:graph', this.render, this);

    $("#override-success-emails").click(function (evt) {
      if ($(this).is(':checked')) {
        $('#success-emails').attr('disabled', null);
      } else {
        $('#success-emails').attr('disabled', "disabled");
      }
    });

    $("#override-failure-emails").click(function (evt) {
      if ($(this).is(':checked')) {
        $('#failure-emails').attr('disabled', null);
      } else {
        $('#failure-emails').attr('disabled', "disabled");
      }
    });

    $("#open-joblist-btn2").click(this.handleOpen);
    $("#joblist-panel2").hide();

    this.filterInput = $(this.el).find("#filter");
    this.list = $(this.el).find("#joblist");
    this.listNodes = {};
  },

  render: function () {
    console.log('-------- render ----------');
    var data = this.model.attributes.data;
    this.renderTree(this.list, data);
  },

  renderTree: function (el, data, prefix) {
    var nodes = data.nodes;
    if (nodes.length == 0) {
      console.log("No results");
      return;
    }
    ;
    if (!prefix) {
      prefix = "";
    }

    var nodeArray = nodes.slice(0);
    nodeArray.sort(function (a, b) {
      var diff = a.y - b.y;
      if (diff == 0) {
        return a.x - b.x;
      }
      else {
        return diff;
      }
    });

    var ul = document.createElement('ul');
    $(ul).addClass("tree-list");
    for (var i = 0; i < nodeArray.length; ++i) {
      var li = document.createElement("li");
      $(li).addClass("listElement");
      $(li).addClass("tree-list-item");

      // This is used for the filter step.
      var listNodeName = prefix + nodeArray[i].id;
      this.listNodes[listNodeName] = li;
      li.node = nodeArray[i];
      li.node.listElement = li;

      var a = document.createElement("a");
      var iconDiv = document.createElement('div');
      $(iconDiv).addClass('icon');

      $(a).append(iconDiv);

      var span = document.createElement("span");
      $(span).text(nodeArray[i].id);
      $(span).addClass("jobname");
      $(a).append(span);
      $(li).append(a);
      $(ul).append(li);

      if (nodeArray[i].type == "flow") {
        // Add the up down
        var expandDiv = document.createElement("div");
        $(expandDiv).addClass("expandarrow glyphicon glyphicon-chevron-down");
        $(a).append(expandDiv);

        if (atLeastOneChildHasChildren(nodeArray[i])) {
          // Add the double down expand all
          var expandAllDiv = createExpandAllButton();
          $(a).append(expandAllDiv);
        }

        // Create subtree
        var subul = this.renderTree(li, nodeArray[i], listNodeName + ":");
        $(subul).hide();
      }
    }

    $(el).append(ul);
    return ul;
  },

  filterJobs: function (self) {
    var filter = this.filterInput.val();
    // Clear all filters first
    if (!filter || filter.trim() == "") {
      this.unfilterAll(self);
      return;
    }

    this.hideAll(self);
    var showList = {};

    // find the jobs that need to be exposed.
    for (var key in this.listNodes) {
      var li = this.listNodes[key];
      var node = li.node;
      var nodeName = node.id;
      node.listElement = li;

      var index = nodeName.indexOf(filter);
      if (index == -1) {
        continue;
      }

      var spanlabel = $(li).find("> a > span");

      var endIndex = index + filter.length;
      var newHTML = nodeName.substring(0, index) + "<span class=\"filterHighlight\">" +
          nodeName.substring(index, endIndex) + "</span>" + nodeName.substring(endIndex, nodeName.length);
      $(spanlabel).html(newHTML);

      // Apply classes to all the included embedded flows.
      var pIndex = key.length;
      while ((pIndex = key.lastIndexOf(":", pIndex - 1)) > 0) {
        var parentId = key.substr(0, pIndex);
        var parentLi = this.listNodes[parentId];
        $(parentLi).show();
        $(parentLi).addClass("subFilter");
      }
      $(li).show();
    }
  },

  hideAll: function (self) {
    for (var key in this.listNodes) {
      var li = this.listNodes[key];
      var label = $(li).find("> a > span");
      $(label).text(li.node.id);
      $(li).removeClass("subFilter");
      $(li).hide();
    }
  },

  unfilterAll: function (self) {
    for (var key in this.listNodes) {
      var li = this.listNodes[key];
      var label = $(li).find("> a > span");
      $(label).text(li.node.id);
      $(li).removeClass("subFilter");
      $(li).show();
    }
  },

  handleJobClick: function (evt) {
    console.log("Job clicked");
    var li = $(evt.currentTarget).closest("li.listElement");
    var node = li[0].node;
    if (!node) {
      return;
    }

    if (this.model.has("selected")) {
      var selected = this.model.get("selected");
      if (selected == node) {
        this.model.unset("selected");
      }
      else {
        this.model.set({"selected": node});
      }
    }
    else {
      this.model.set({"selected": node});
    }

    evt.stopPropagation();
    evt.cancelBubble = true;
  },

  handleClose: function (evt) {
    $("#joblist-panel2").fadeOut();
  },

  handleOpen: function (evt) {
    $("#joblist-panel2").fadeIn();
  },

  getExecutionOptionData: function () {
    var failureAction = $('#failure-action').val();
    var failureEmails = $('#failure-emails').val();
    var successEmails = $('#success-emails').val();
    var notifyFailureFirst = $('#notify-failure-first').is(':checked');
    var notifyFailureLast = $('#notify-failure-last').is(':checked');
    var failureEmailsOverride = $("#override-failure-emails").is(':checked');
    var successEmailsOverride = $("#override-success-emails").is(':checked');

    var runtimeProperty = {};
    var editRows = $(".editRow");
    for (var i = 0; i < editRows.length; ++i) {
      var row = editRows[i];
      var node = row.cells[0].firstChild.value;
      var td = $(row).find('span');
      var key = $(td[0]).text();
      var val = $(td[1]).text();

      if (key && key.length > 0) {
        if (node && node.length > 0) {
          runtimeProperty[node] = runtimeProperty[node] || {}
          runtimeProperty[node][key] = val;
        }
      }
    }

    var data = this.model.get("data");
    var disabledList = gatherDisabledNodes(data);

    var executingData = {
      projectId: projectId,
      project: this.projectName,
      ajax: "executeFlow",
      flow: this.flowId,
      disabled: JSON.stringify(disabledList),
      failureEmailsOverride: failureEmailsOverride,
      successEmailsOverride: successEmailsOverride,
      failureAction: failureAction,
      failureEmails: failureEmails,
      successEmails: successEmails,
      notifyFailureFirst: notifyFailureFirst,
      notifyFailureLast: notifyFailureLast,
      runtimeProperty: runtimeProperty,
    };

    // Set concurrency option, default is skip

    var concurrentOption = $('input[name=concurrent]:checked').val();
    executingData.concurrentOption = concurrentOption;
    if (concurrentOption == "pipeline") {
      var pipelineLevel = $("#pipeline-level").val();
      executingData.pipelineLevel = pipelineLevel;
    } else if (concurrentOption == "queue") {
      executingData.queueLevel = $("#queueLevel").val();
    }

    return executingData;
  },

  changeFlowInfo: function () {
    var successEmails = this.model.get("successEmails");
    var failureEmails = this.model.get("failureEmails");
    var failureActions = this.model.get("failureAction");
    var notifyFailure = this.model.get("notifyFailure");
    var runtimeProperties = this.model.get("runtimeProperties");
    var isRunning = this.model.get("isRunning");
    var concurrentOption = this.model.get("concurrentOption");
    var pipelineLevel = this.model.get("pipelineLevel");
    var pipelineExecutionId = this.model.get("pipelineExecution");
    var queueLevel = this.model.get("queueLevel");
    var nodeStatus = this.model.get("nodeStatus");
    var overrideSuccessEmails = this.model.get("successEmailsOverride");
    var overrideFailureEmails = this.model.get("failureEmailsOverride");

    if (overrideSuccessEmails) {
      $('#override-success-emails').prop('checked', true);
    } else {
      $('#success-emails').attr('disabled', 'disabled');
    }
    if (overrideFailureEmails) {
      $('#override-failure-emails').prop('checked', true);
    } else {
      $('#failure-emails').attr('disabled', 'disabled');
    }

    if (successEmails) {
      $('#success-emails').val(successEmails.join());
    }
    if (failureEmails) {
      $('#failure-emails').val(failureEmails.join());
    }
    if (failureActions) {
      $('#failure-action').val(failureActions);
    }

    if (notifyFailure.first) {
      $('#notify-failure-first').prop('checked', true);
      $('#notify-failure-first').parent('.btn').addClass('active');
    }
    if (notifyFailure.last) {
      $('#notify-failure-last').prop('checked', true);
      $('#notify-failure-last').parent('.btn').addClass('active');
    }

    if (concurrentOption) {
      $('input[value=' + concurrentOption + '][name="concurrent"]').attr(
          'checked', true);
    }
    if (pipelineLevel) {
      $('#pipeline-level').val(pipelineLevel);
    }
    if (queueLevel) {
      $('#queueLevel').val(queueLevel);
    }

    if ($(".editRow").length == 0) {
      if (runtimeProperties) {
        for (var jobOrFlow in runtimeProperties) {
          for (var key in runtimeProperties[jobOrFlow]) {
            editTableView.handleAddRow({
              paramJobOrFlow: jobOrFlow,
              paramkey: key,
              paramvalue: runtimeProperties[jobOrFlow][key]
            });
          }
        }
      }
    }
  },

  show: function (data) {
    var projectName = data.project;
    var flowId = data.flow;
    var jobId = data.job;

    // ExecId is optional
    var execId = data.execid;
    var exgraph = data.exgraph;

    this.projectName = projectName;
    this.flowId = flowId;

    var self = this;
    var loadCallback = function () {
      // loadFlowInfo needs the list of nestedIds. that's why loading
      // it here in the callback.
      self.loadFlowInfo(projectName, flowId, execId);
      if (jobId) {
        self.showExecuteJob(projectName, flowId, jobId, data.withDep);
      } else {
        self.showExecuteFlow(projectName, flowId);
      }
    }

    var loadedId = executableGraphModel.get("flowId");
    this.loadGraph(projectName, flowId, exgraph, loadCallback);
  },

  showExecuteFlow: function (projectName, flowId) {
    $("#execute-flow-panel-title").text("Execute Flow " + flowId);
    this.showExecutionOptionPanel();

    // Triggers a render
    this.model.trigger("change:graph");
  },

  showExecuteJob: function (projectName, flowId, jobId, withDep) {
    sideMenuDialogView.menuSelect($("#flow-option"));
    $("#execute-flow-panel-title").text("Execute Flow " + flowId);

    var data = this.model.get("data");
    var disabled = this.model.get("disabled");

    // Disable all, then re-enable those you want.
    disableAll();

    var jobNode = data.nodeMap[jobId];
    touchNode(jobNode, false);

    if (withDep) {
      recurseAllAncestors(jobNode, false);
    }

    this.showExecutionOptionPanel();
    this.model.trigger("change:graph");
  },

  showExecutionOptionPanel: function () {
    sideMenuDialogView.menuSelect($("#flow-option"));
    $('#execute-flow-panel').modal();
  },

  hideExecutionOptionPanel: function () {
    $('#execute-flow-panel').modal("hide");
  },

  scheduleClick: function () {
    this.hideExecutionOptionPanel();
    schedulePanelView.showSchedulePanel();
  },

  loadFlowInfo: function (projectName, flowId, execId) {
    fetchFlowInfo(this.model, projectName, flowId, execId);
  },

  loadGraph: function (projectName, flowId, exgraph, callback) {
    var requestURL = contextURL + "/executor";

    var graphModel = executableGraphModel;
    var requestData = {
      "project": projectName,
      "ajax": "fetchscheduledflowgraph",
      "flow": flowId
    };
    var self = this;
    var successHandler = function (data) {
      graphModel.addFlow(data);

      if (exgraph) {
        self.assignInitialStatus(data, exgraph);
      }

      // Auto disable jobs that are finished.
      disableFinishedJobs(data);
      executingSvgGraphView = new azkaban.SvgGraphView({
        el: $('#flow-executing-graph'),
        model: graphModel,
        render: false,
        rightClick: {
          "node": expanelNodeClickCallback,
          "edge": expanelEdgeClickCallback,
          "graph": expanelGraphClickCallback
        },
        tooltipcontainer: "#svg-div-custom"
      });

      if (callback) {
        callback.call(this);
      }
    };
    $.get(requestURL, requestData, successHandler, "json");
  },

  assignInitialStatus: function (data, statusData) {
    // Copies statuses over from the previous execution if it exists.
    var statusNodeMap = statusData.nodeMap;
    var nodes = data.nodes;
    for (var i = 0; i < nodes.length; ++i) {
      var node = nodes[i];
      var statusNode = statusNodeMap[node.id];
      if (statusNode) {
        node.status = statusNode.status;
        if (node.type == "flow" && statusNode.type == "flow") {
          this.assignInitialStatus(node, statusNode);
        }
      } else {
        // job wasn't present in this flow during the original execution
        node.noInitialStatus = true;
      }
    }
  },

  handleExecuteFlow: function (evt) {
    var executingData = this.getExecutionOptionData();
    executeFlow(executingData);
  }
});

var editTableView;
azkaban.EditTableView = Backbone.View.extend({
  events: {
    "click table #add-btn": "handleAddRow",
    "click table .editable": "handleEditColumn",
    "click table .remove-btn": "handleRemoveColumn"
  },

  initialize: function (setting) {
  },

  handleAddRow: function (data) {
    var nestedIds = executableGraphModel.get("nestedIds");

    var jobOrFlow = "";
    if (data.paramJobOrFlow) {
      jobOrFlow = data.paramJobOrFlow;
    }

    var name = "";
    if (data.paramkey) {
      name = data.paramkey;
    }

    var value = "";
    if (data.paramvalue) {
      value = data.paramvalue;
    }

    var tr = document.createElement("tr");
    var tdJobOrFlow = document.createElement("td");
    var tdName = document.createElement("td");
    $(tdName).addClass('property-key');
    var tdValue = document.createElement("td");
    var tdDelete = document.createElement("td");

    var remove = document.createElement("div");
    $(remove).addClass("pull-right").addClass('remove-btn');
    var removeBtn = document.createElement("button");
    $(removeBtn).attr('type', 'button');
    $(removeBtn).addClass('btn').addClass('btn-xs').addClass('btn-danger');
    $(removeBtn).text('Delete');
    $(remove).append(removeBtn);

    var nameData = document.createElement("span");
    $(nameData).addClass("spanValue");
    $(nameData).text(name);
    var valueData = document.createElement("span");
    $(valueData).addClass("spanValue");
    $(valueData).text(value);

    var idSelect = document.createElement("select");
    idSelect.setAttribute("class", "form-control");

    idSelect.options[0] = new Option("ROOT", "ROOT");

    // runtime properties
    for (var i = 0; i < nestedIds.length; ++i) {
      var nestedId = nestedIds[i];
      idSelect.options[i + 1] = new Option(nestedId, nestedId);
      if (jobOrFlow === nestedId) {
        idSelect.options[i + 1].selected = true;
      }
    }

    tdJobOrFlow.appendChild(idSelect)

    $(tdName).append(nameData);
    $(tdName).addClass("editable");

    $(tdValue).append(valueData);
    $(tdDelete).append(remove);
    $(tdValue).addClass("editable").addClass('value');

    $(tr).addClass("editRow");
    $(tr).append(tdJobOrFlow);
    $(tr).append(tdName);
    $(tr).append(tdValue);
    $(tr).append(tdDelete);

    $(tr).insertBefore(".addRow");
    return tr;
  },

  handleEditColumn: function (evt) {
    if (evt.target.tagName == "INPUT") {
      return;
    }
    var curTarget = evt.currentTarget;

    var text = $(curTarget).children(".spanValue").text();
    $(curTarget).empty();

    var input = document.createElement("input");
    $(input).attr("type", "text");
    $(input).addClass('form-control').addClass('input-sm');
    $(input).css("width", "100%");
    $(input).val(text);
    $(curTarget).addClass("editing");
    $(curTarget).append(input);
    $(input).focus();

    var obj = this;
    $(input).focusout(function (evt) {
      obj.closeEditingTarget(evt);
    });

    $(input).keypress(function (evt) {
      if (evt.which == 13) {
        obj.closeEditingTarget(evt);
      }
    });
  },

  handleRemoveColumn: function (evt) {
    var curTarget = evt.currentTarget;
    // Should be the table
    var row = curTarget.parentElement.parentElement;
    $(row).remove();
  },

  closeEditingTarget: function (evt) {
    var input = evt.currentTarget;
    var text = $(input).val();
    var parent = $(input).parent();
    $(parent).empty();

    var valueData = document.createElement("span");
    $(valueData).addClass("spanValue");
    $(valueData).text(text);

    $(parent).removeClass("editing");
    $(parent).append(valueData);
  }
});

var sideMenuDialogView;
azkaban.SideMenuDialogView = Backbone.View.extend({
  events: {
    "click .menu-header": "menuClick"
  },

  initialize: function (settings) {
    var children = $(this.el).children();
    for (var i = 0; i < children.length; ++i) {
      var child = children[i];
      $(child).addClass("menu-header");
      var caption = $(child).find(".menu-caption");
      $(caption).hide();
    }
    this.menuSelect($("#flow-option"));
  },

  menuClick: function (evt) {
    this.menuSelect(evt.currentTarget);
  },

  menuSelect: function (target) {
    if ($(target).hasClass("active")) {
      return;
    }

    $(".side-panel").each(function () {
      $(this).hide();
    });

    $(".menu-header").each(function () {
      $(this).find(".menu-caption").slideUp("fast");
      $(this).removeClass("active");
    });

    $(target).addClass("active");
    $(target).find(".menu-caption").slideDown("fast");
    var panelName = $(target).attr("viewpanel");
    $("#" + panelName).show();
  }
});

var handleJobMenuClick = function (action, el, pos) {
  var jobid = el[0].jobid;

  var requestURL = contextURL + "/manager?project=" + projectName + "&flow="
      + flowName + "&job=" + jobid;
  if (action == "open") {
    window.location.href = requestURL;
  } else if (action == "openwindow") {
    window.open(requestURL);
  }
}

var executableGraphModel;

/**
 * Disable jobs that need to be disabled
 */
var disableFinishedJobs = function (data) {
  for (var i = 0; i < data.nodes.length; ++i) {
    var node = data.nodes[i];

    if (node.status == "DISABLED" || node.status == "SKIPPED") {
      node.status = "READY";
      node.disabled = true;
    } else if (node.status == "SUCCEEDED" || node.noInitialStatus) {
      node.disabled = true;
    } else {
      node.disabled = false;
    }
    if (node.type == "flow") {
      disableFinishedJobs(node);
    }
  }
}

/**
 * Enable all jobs. Recurse
 */
var enableAll = function () {
  recurseTree(executableGraphModel.get("data"), false, false);
  executableGraphModel.trigger("change:disabled");
}

var disableAll = function () {
  recurseTree(executableGraphModel.get("data"), true, false);
  executableGraphModel.trigger("change:disabled");
}

var recurseTree = function (data, disabled, recurse) {
  for (var i = 0; i < data.nodes.length; ++i) {
    var node = data.nodes[i];
    node.disabled = disabled;

    if (node.type == "flow" && recurse) {
      recurseTree(node, disabled);
    }
  }
}

var touchNode = function (node, disable) {
  node.disabled = disable;
  executableGraphModel.trigger("change:disabled");
}

var touchParents = function (node, disable) {
  var inNodes = node.inNodes;

  if (inNodes) {
    for (var key in inNodes) {
      inNodes[key].disabled = disable;
    }
  }

  executableGraphModel.trigger("change:disabled");
}

var touchChildren = function (node, disable) {
  var outNodes = node.outNodes;

  if (outNodes) {
    for (var key in outNodes) {
      outNodes[key].disabled = disable;
    }
  }

  executableGraphModel.trigger("change:disabled");
}

var touchAncestors = function (node, disable) {
  recurseAllAncestors(node, disable);

  executableGraphModel.trigger("change:disabled");
}

var touchDescendents = function (node, disable) {
  recurseAllDescendents(node, disable);

  executableGraphModel.trigger("change:disabled");
}

var gatherDisabledNodes = function (data) {
  var nodes = data.nodes;
  var disabled = [];

  for (var i = 0; i < nodes.length; ++i) {
    var node = nodes[i];
    if (node.disabled) {
      disabled.push(node.id);
    } else {
      if (node.type == "flow") {
        var array = gatherDisabledNodes(node);
        if (array && array.length > 0) {
          disabled.push({id: node.id, children: array});
        }
      }
    }
  }

  return disabled;
}

function recurseAllAncestors(node, disable) {
  var inNodes = node.inNodes;
  if (inNodes) {
    for (var key in inNodes) {
      inNodes[key].disabled = disable;
      recurseAllAncestors(inNodes[key], disable);
    }
  }
}

function recurseAllDescendents(node, disable) {
  var outNodes = node.outNodes;
  if (outNodes) {
    for (var key in outNodes) {
      outNodes[key].disabled = disable;
      recurseAllDescendents(outNodes[key], disable);
    }
  }
}

var expanelNodeClickCallback = function (event, model, node) {
  var jobId = node.id;
  var flowId = node.parent.flow;
  var type = node.type;

  var menu;
  if (type == "flow") {
    var flowRequestURL = contextURL + "/manager?project=" + projectName
        + "&flow=" + node.flowId;
    if (node.expanded) {
      menu = [
        {
          title: "Collapse Flow...", callback: function () {
            model.trigger("collapseFlow", node);
          }
        },
        {
          title: "Collapse All Flows...", callback: function () {
            model.trigger("collapseAllFlows", node);
          }
        },
        {
          title: "Open Flow in New Window...", callback: function () {
            window.open(flowRequestURL);
          }
        }
      ];

    } else {
      menu = [
        {
          title: "Expand Flow...", callback: function () {
            model.trigger("expandFlow", node);
          }
        },
        {
          title: "Expand All Flows...", callback: function () {
            model.trigger("expandAllFlows", node);
          }
        },
        {
          title: "Open Flow in New Window...", callback: function () {
            window.open(flowRequestURL);
          }
        }
      ];
    }
  } else {
    var requestURL = contextURL + "/manager?project=" + projectName + "&flow="
        + flowId + "&job=" + jobId;
    menu = [
      {
        title: "Open Job in New Window...", callback: function () {
          window.open(requestURL);
        }
      },
    ];
  }

  $.merge(menu, [
    {break: 1},
    {
      title: "Enable", callback: function () {
        touchNode(node, false);
      }, submenu: [
        {
          title: "Parents", callback: function () {
            touchParents(node, false);
          }
        },
        {
          title: "Ancestors", callback: function () {
            touchAncestors(node, false);
          }
        },
        {
          title: "Children", callback: function () {
            touchChildren(node, false);
          }
        },
        {
          title: "Descendents", callback: function () {
            touchDescendents(node, false);
          }
        },
        {
          title: "Enable All", callback: function () {
            enableAll();
          }
        }
      ]
    },
    {
      title: "Disable", callback: function () {
        touchNode(node, true)
      }, submenu: [
        {
          title: "Parents", callback: function () {
            touchParents(node, true);
          }
        },
        {
          title: "Ancestors", callback: function () {
            touchAncestors(node, true);
          }
        },
        {
          title: "Children", callback: function () {
            touchChildren(node, true);
          }
        },
        {
          title: "Descendents", callback: function () {
            touchDescendents(node, true);
          }
        },
        {
          title: "Disable All", callback: function () {
            disableAll();
          }
        }
      ]
    },
    {
      title: "Center Job", callback: function () {
        model.trigger("centerNode", node);
      }
    }
  ]);

  contextMenuView.show(event, menu);
}

var expanelEdgeClickCallback = function (event) {
}

var expanelGraphClickCallback = function (event, model) {
  var data = model.get("data");
  var flowId = data.flow;
  var requestURL = contextURL + "/manager?project=" + projectName + "&flow="
      + flowId;

  var menu = [
    {
      title: "Expand All Flows...", callback: function () {
        executableGraphModel.trigger("expandAllFlows");
        executableGraphModel.trigger("resetPanZoom");
      }
    },
    {
      title: "Collapse All Flows...", callback: function () {
        executableGraphModel.trigger("collapseAllFlows");
        executableGraphModel.trigger("resetPanZoom");
      }
    },
    {
      title: "Open Flow in New Window...", callback: function () {
        window.open(requestURL);
      }
    },
    {break: 1},
    {
      title: "Expand Flows 1 Level...", callback: function () {
        executableGraphModel.trigger("expandFlows1");
        executableGraphModel.trigger("resetPanZoom");
      }
    },
    {
      title: "Expand Flows 2 Levels...", callback: function () {
        executableGraphModel.trigger("expandFlows2");
        executableGraphModel.trigger("resetPanZoom");
      }
    },
    {
      title: "Expand Flows 3 Levels...", callback: function () {
        executableGraphModel.trigger("expandFlows3");
        executableGraphModel.trigger("resetPanZoom");
      }
    },
    {break: 1},
    {
      title: "Enable All", callback: function () {
        enableAll();
      }
    },
    {
      title: "Disable All", callback: function () {
        disableAll();
      }
    },
    {break: 1},
    {
      title: "Center Graph", callback: function () {
        executableGraphModel.trigger("resetPanZoom");
      }
    }
  ];

  contextMenuView.show(event, menu);
}

var contextMenuView;
$(function () {
  executableGraphModel = new azkaban.GraphModel();
  flowExecuteDialogView = new azkaban.FlowExecuteDialogView({
    el: $('#execute-flow-panel'),
    model: executableGraphModel
  });

  sideMenuDialogView = new azkaban.SideMenuDialogView({
    el: $('#graph-options')
  });
  editTableView = new azkaban.EditTableView({
    el: $('#editTable')
  });

  contextMenuView = new azkaban.ContextMenuView({
    el: $('#contextMenu')
  });

  $(document).keyup(function (e) {
    // escape key maps to keycode `27`
    if (e.keyCode == 27) {
      flowExecuteDialogView.hideExecutionOptionPanel();
    }
  });
});
