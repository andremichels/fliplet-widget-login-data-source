
var widgetId = Fliplet.Widget.getDefaultId();
var data = Fliplet.Widget.getData(widgetId) || {};
var organizationId = Fliplet.Env.get('organizationId');
var validInputEventName = 'interface-validate';

var allDataSources;
var initialLoadingDone = false;

var templates = {
  dataSourceEntry: template('data-source-entry')
};

var defaultEmailTemplate = $('#template-email-default').html();

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

  
  
  var definition = currentDataSource.definition || {};
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
  dataSources.forEach(renderDataSource);
  return Promise.resolve();
}).then(initialiseData);

function renderDataSource(dataSource){
  $('#dataSource').append(templates.dataSourceEntry(dataSource));
}

function renderDataSourceColumn(dataSourceColumn){
  $('#emailColumn').append('<option value="'+dataSourceColumn+'">'+dataSourceColumn+'</option>');
  $('#passColumn').append('<option value="'+dataSourceColumn+'">'+dataSourceColumn+'</option>');
}

$('#dataSource').on('change', function onDataSourceListChange() {
  var selectedOption = $(this).find("option:selected"),
      selectedText = selectedOption.text(),
      selectedValue = selectedOption.val();

  $(this).parents('.select-proxy-display').find('.select-value-proxy').html(selectedText);
  $('#emailColumn option:gt(0)').remove();
  $('#passColumn option:gt(0)').remove();

  if ( $(this).val() !== "none" ) {
    $('#select-email-field').removeClass('hidden');
    $('#select-pass-field').removeClass('hidden');
  } else {
    $('#select-email-field').addClass('hidden');
    $('#select-pass-field').addClass('hidden');
  }

  allDataSources.forEach(function(dataSource){
    if(dataSource.id == selectedValue && typeof dataSource.columns !== "undefined") {
      currentDataSource = dataSource;
      dataSource.columns.forEach(renderDataSourceColumn);
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
