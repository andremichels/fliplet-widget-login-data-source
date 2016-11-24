var widgetId = Fliplet.Widget.getDefaultId();
var data = Fliplet.Widget.getData(widgetId) || {};
var headingValue = data.heading || "Welcome to the login of this app";
$('#login_heading').val(headingValue).trigger('change');

var linkActionProvider = Fliplet.Widget.open('com.fliplet.link', {
  // If provided, the iframe will be appended here,
  // otherwise will be displayed as a full-size iframe overlay
  selector: '#action',
  // Also send the data I have locally, so that
  // the interface gets repopulated with the same stuff
  data: data.action,
  // Events fired from the provider
  onEvent: function (event, data) {
    if (event === 'interface-validate') {
      Fliplet.Widget.toggleSaveButton(data.isValid === true);
    }
  }
});

// 1. Fired from Fliplet Studio when the external save button is clicked
Fliplet.Widget.onSaveRequest(function () {
  $('form').submit();
});

// 2. Fired when the user submits the form
$('form').submit(function (event) {
  event.preventDefault();
  linkActionProvider.forwardSaveRequest();
});

// 3. Fired when the provider has finished
linkActionProvider.then(function (result) {
  data.action = result.data;
  save(true);
});

function save(notifyComplete) {
  data.heading = $('#login_heading').val();
  Fliplet.Widget.save(data).then(function () {
    if (notifyComplete) {
      Fliplet.Widget.complete();
      window.location.reload();
    } else {
      Fliplet.Studio.emit('reload-widget-instance', widgetId);
    }
  });
}

$('#select_datasource').on('change', function() {
  var selectedValue = $(this).val();
  var selectedText = $(this).find("option:selected").text();
  $(this).parents('.select-proxy-display').find('.select-value-proxy').html(selectedText);

  if (selectedValue !== "") {
    $('#select-email-field').removeClass('hidden');
    $('#select-pass-field').removeClass('hidden');
  } else {
    $('#select-email-field').addClass('hidden');
    $('#select-pass-field').addClass('hidden');
  }
});

$('#select_email, #select_pass').on('change', function() {
  var selectedValue = $(this).val();
  var selectedText = $(this).find("option:selected").text();
  $(this).parents('.select-proxy-display').find('.select-value-proxy').html(selectedText);
});

$('#allow_reset').on('change', function() {
  if ( $(this).is(':checked') ) {
    $('.reset-pass-redirect').removeClass('hidden');
  } else {
    $('.reset-pass-redirect').addClass('hidden');
  }
});




$('#login_heading').on('keyup change paste blur', $.debounce(function() {
  save();
}, 500));

$('#help_tip').on('click', function() {
  alert("During beta, please use live chat and let us know what you need help with.");
});
