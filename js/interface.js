
var widgetId = Fliplet.Widget.getDefaultId();
var data = Fliplet.Widget.getData(widgetId) || {};
var organizationId = Fliplet.Env.get('organizationId');
var validInputEventName = 'interface-validate';

var $dataSource = $('#dataSource');
var allDataSources;
var initialLoadingDone = false;

var templates = {
  dataSourceEntry: template('data-source-entry')
};

var defaultEmailTemplate = $('#email-template-default').html();

var fields = [
  'dataSource',
  'emailColumn',
  'passColumn',
  'emailTemplate'
];

var linkData = $.extend(true, {
  action: 'screen',
  page: 'none',
  transition: 'slide.left',
  options: {
    hideAction: true
  }
}, data.loginAction);

var loginActionProvider = Fliplet.Widget.open('com.fliplet.link', {
  // If provided, the iframe will be appended here,
  // otherwise will be displayed as a full-size iframe overlay
  selector: '#login-link-action',
  // Also send the data I have locally, so that
  // the interface gets repopulated with the same stuff
  data: linkData,
  // Events fired from the provider
  onEvent: function (event, data) {
    if (event === 'interface-validate') {
      Fliplet.Widget.toggleSaveButton(data.isValid === true);
    }
  }
});

// TinyMCE INIT
tinymce.init({
  selector: '#validationEmail',
  theme: 'modern',
  plugins: [
    'advlist lists link image charmap hr',
    'searchreplace insertdatetime table textcolor colorpicker code'
  ],
  toolbar: 'formatselect | fontselect fontsizeselect | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | link | bullist numlist outdent indent | blockquote subscript superscript | table charmap hr | removeformat | code',
  menubar: false,
  statusbar: true,
  inline: false,
  resize: true,
  min_height: 300,
  setup : function(editor) {
    editor.on('init', function() {
      if ("emailTemplate" in data && data.emailTemplate !== "") {
        tinymce.get('validationEmail').setContent(data.emailTemplate);
      } else {
        tinymce.get('validationEmail').setContent(defaultEmailTemplate);
      }
    });
    editor.on('keyup paste', function(e) {
      data.emailTemplate = editor.getContent();
    });
  }
});

// 1. Fired from Fliplet Studio when the external save button is clicked
Fliplet.Widget.onSaveRequest(function () {
  $('form').submit();
});

// 2. Fired when the user submits the form
$('form').submit(function (event) {
  event.preventDefault();
  loginActionProvider.forwardSaveRequest();
});

// 3. Fired when the provider has finished
loginActionProvider.then(function (result) {
  data.loginAction = result.data;
  save(true);
});

// Function to compile a Handlebars template
function template(name) {
  return Handlebars.compile($('#template-' + name).html());
}

function save(notifyComplete) {
  // Get and save values to data
  fields.forEach(function (fieldId) {
    data[fieldId] = $('#' + fieldId).val();
  });

  
  
  var definition = currentDataSource && currentDataSource.definition || {};
  var validation = {
    email: {
      domain: false,
      expire: "60",
      domains: [],
      template: {
        to: [],
        html: data.emailTemplate || defaultEmailTemplate,
        subject: "Validate your email address"
      },
      toColumn: data.emailColumn,
      matchColumn: data.emailColumn
    }
  };
  definition.validation = validation;

  // Update data source definitions
  var options = { id: data.dataSource, definition: definition };
  Fliplet.DataSources.update(options)
    .then(function() {
      Fliplet.Widget.save(data).then(function () {
        if (notifyComplete) {
          Fliplet.Widget.complete();
          window.location.reload();
        } else {
          Fliplet.Studio.emit('reload-widget-instance', widgetId);
        }
      });
    })
}

Fliplet.Widget.emit(validInputEventName, {
  isValid: false
});

Fliplet.DataSources.get({ organizationId: organizationId }).then(function (dataSources) {
  allDataSources = dataSources || [];
  $dataSource.html('<option value="">-- Select a data source --</option>');
  dataSources.forEach(renderDataSource);
  return Promise.resolve();
}).then(initialiseData);

function reloadDataSource(dataSourceId) {
  Fliplet.DataSources.get({ organizationId: organizationId }, {cache: false}).then(function (dataSources) {
    allDataSources = dataSources || [];
    $dataSource.html('<option value="">-- Select a data source --</option>');
    dataSources.forEach(renderDataSource);
    return Promise.resolve();
  }).then(function() {
    $dataSource.val(dataSourceId);
    $dataSource.trigger('change');
  });
}

function renderDataSource(dataSource){
  $dataSource.append(templates.dataSourceEntry(dataSource));
}

function renderDataSourceColumn(dataSourceColumn){
  $('#emailColumn').append('<option value="'+dataSourceColumn+'">'+dataSourceColumn+'</option>');
  $('#passColumn').append('<option value="'+dataSourceColumn+'">'+dataSourceColumn+'</option>');
}

function createDataSource() {
  event.preventDefault();
  var name = prompt('Please type a name for your data source:');

  if (name === null) {
    $dataSources.val(_this.source);
    return;
  }

  if (name === '') {
    $dataSources.val(_this.source);
    alert('You must enter a data source name');
    return;
  }

  Fliplet.DataSources.create({
    name: name,
    organizationId: Fliplet.Env.get('organizationId')
  }).then(function(ds) {
    allDataSources.push(ds);
    $dataSource.append('<option value="' + ds.id + '">' + ds.name + '</option>');
    $dataSource.val(ds.id).trigger('change');
  });
}

function manageAppData() {
  var dataSourceId = $dataSource.val();
  Fliplet.Studio.emit('overlay', {
    name: 'widget',
    options: {
      size: 'large',
      package: 'com.fliplet.data-sources',
      title: 'Edit Data Sources',
      classes: 'data-source-overlay',
      data: {
        context: 'overlay',
        dataSourceId: dataSourceId
      }
    }
  });
}

Fliplet.Studio.onMessage(function(event) {
  if (event.data && event.data.event === 'overlay-close') {
    reloadDataSource(event.data.data.dataSourceId);
  }
});

$('#manage-data a').on('click', manageAppData);

$dataSource.on('change', function onDataSourceListChange() {
  var selectedOption = $(this).find("option:selected"),
      selectedText = selectedOption.text(),
      selectedValue = selectedOption.val();

  $(this).parents('.select-proxy-display').find('.select-value-proxy').html(selectedText);
  $('#emailColumn option:gt(0)').remove();
  $('#passColumn option:gt(0)').remove();

  if ( $(this).val() === "new" ) {
    createDataSource();
  }

  if ( $(this).val() !== "none" ) {
    $('#manage-data').removeClass('hidden');
    $('#select-email-field').removeClass('hidden');
    $('#select-pass-field').removeClass('hidden');
  } else {
    $('#manage-data').addClass('hidden');
    $('#select-email-field').addClass('hidden');
    $('#select-pass-field').addClass('hidden');
  }

  allDataSources.forEach(function(dataSource){
    if(dataSource.id == selectedValue && typeof dataSource.columns !== "undefined") {
      currentDataSource = dataSource;
      dataSource.columns.forEach(renderDataSourceColumn);
      $('#emailColumn').trigger('change');
      $('#passColumn').trigger('change');
    }
  });
});

$('#emailColumn, #passColumn').on('change', function() {
  var selectedValue = $(this).val();
  var selectedText = $(this).find("option:selected").text();
  $(this).parents('.select-proxy-display').find('.select-value-proxy').html(selectedText);

  Fliplet.Widget.emit(validInputEventName, {
    isValid: selectedValue !== 'none'
  });
});

$('#allow_reset').on('change', function() {

  if ( $(this).is(':checked') ) {
  	$('.reset-pass-redirect').removeClass('hidden');
    data.allowReset = true;
  } else {
  	$('.reset-pass-redirect').addClass('hidden');
    data.allowReset = false;
  }

  if(initialLoadingDone) {
    save();
  }

  initialLoadingDone = true;
});

$('#help_tip').on('click', function() {
  alert("During beta, please use live chat and let us know what you need help with.");
});

function initialiseData() {

  fields.forEach(function (fieldId) {
    if(data[fieldId]) {
      $('#' + fieldId).val(data[fieldId]).change();
    }
  });

  if ( data.allowReset ) {
    $('#allow_reset').trigger('change');
  }
}
