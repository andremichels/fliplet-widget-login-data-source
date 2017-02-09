String.prototype.hashCode = function(){
  var hash = 0;
  if (this.length == 0) return hash;
  for (i = 0; i < this.length; i++) {
    char = this.charCodeAt(i);
    hash = ((hash<<5)-hash)+char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
};

$('[data-login-ds-id]').each(function(){
  var _this = this;
  var $container = $(this);
  var widgetId = $container.attr('data-login-ds-id');
  var widgetUuid = $container.attr('data-login-ds-uuid');
  var data = Fliplet.Widget.getData(widgetId);

  this.pvName = 'login_data_source_component_' + Fliplet.Env.get('appId');
  var dataStructure = {
    auth_token: '',
    id: '',
    email: '',
    createdAt: null
  };

  var CODE_VALID = 30,
      CODE_LENGTH = 6,
      APP_NAME = Fliplet.Env.get('appName'),
      APP_VALIDATION_DATA_DIRECTORY_ID = data.dataSource,
      DATA_DIRECTORY_EMAIL_COLUMN = data.emailColumn,
      DATA_DIRECTORY_PASS_COLUMN = data.passColumn;

  function initEmailValidation() {
    Fliplet.Security.Storage.init().then(function(){

      attachEventListeners();
      setUserDataPV( function() {
        if(userDataPV.userLogged && !Fliplet.Env.get('interact')) {
          if(typeof data.loginAction !== "undefined") {
            Fliplet.Navigate.to(data.loginAction);
          }
        }
      }, function() {
      });

    });
  }

  function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
  }

  function calculateElHeight(el) {

    var elementHeight = el.outerHeight();
    el.parents('.fl-restore-pass').css('height', elementHeight);

    if (el.hasClass('start')) {
      el.removeClass('start').addClass('present');
    }

  }

  function loginFromDataSource(data_source_id, where, success_callback, fail_callback) {
    Fliplet.DataSources.connect(data_source_id, { offline: false }).then(function(dataSource){
      return dataSource.find({
        where: where
      });
    }).then(function(entries){
      if(entries.length) {
        return success_callback(entry[0]);
      }

      fail_callback(true);
    }, function() {
      fail_callback(true);
    });
  }

  function resetFromDataSource(data_source_id, where, success_callback, fail_callback) {
    Fliplet.DataSources.connect(data_source_id, { offline: false }).then(function(dataSource){
      return dataSource.find({
        where: where
      });
    }).then(function(entries){
      if (entries.length) {
        success_callback(entry[0]);
      }

      fail_callback(true);
    }, function() {
      fail_callback(true);
    });
  }

  function sendEmail(body, replyTo, subject, to, success_callback, fail_callback) {

    var options = {
      "to": [{
        "email": to,
        "name": "",
        "type": "to"
      }],
      "html": body,
      "subject": subject
    };

    Fliplet.Communicate.sendEmail(options).then(success_callback, fail_callback);

  }

  function sendNotification(contact, success_callback, fail_callback) {

    // Let's update the PV with this new data
    userDataPV.code = rDigits(CODE_LENGTH);
    userDataPV.code_generated_at = Date.now();
    Fliplet.Security.Storage.update().then(function(){
      var body = generateVerifyBody();

      sendEmail(body, contact, APP_NAME, contact, success_callback, fail_callback);
    });
  }

  function generateVerifyBody() {
    var body;
    var string = $("#email-template-holder").html();
    var template = Handlebars.compile(string);
    body = template({
      code: userDataPV.code,
      time: moment().format('MMM Do YY, h:mm:ss a'),
      app_name: APP_NAME,
      code_duration: CODE_VALID
    });

    return body;
  }

  function rDigits(length) {
    var r = Math.random().toString().slice(2, length + 2);
    return r.length === length ? r : rDigits(length);
  }

  function attachEventListeners() {

    $container.find('.btn-login').on('click', function() {
      var _this = $(this);
      _this.parents('.form-btns').find('.text-danger').addClass('hidden');

      window.profileEmail = $container.find('input.profile_email').val().toLowerCase(); // GET EMAIL VALUE

      // @TODO: Add SALT and change HASHING method
      var hashedPass = $container.find('input.profile_password').val().hashCode();
      window.profilePassword = hashedPass;

      // Triggers loading
      $(this).addClass('loading');
      $(this).find('span').addClass('hidden');
      $(this).find('.loader').addClass('show');

      if (validateEmail(profileEmail)) {
        // CHECK FOR EMAIL ON DATA SOURCE
        var where = {};
        where[DATA_DIRECTORY_EMAIL_COLUMN] = profileEmail;
        where[DATA_DIRECTORY_PASS_COLUMN] = profilePassword;
        loginFromDataSource(APP_VALIDATION_DATA_DIRECTORY_ID, where, function (entry) {
          // Reset Login button
          userDataPV.entry = entry;
          userDataPV.userLogged = true;
          // Set PV to be used by Chat
          Fliplet.App.Storage.set('fl-chat-auth-email', profileEmail);
          Fliplet.Security.Storage.update().then(function () {

            _this.removeClass('loading');
            _this.find('span').removeClass('hidden');
            _this.find('.loader').removeClass('show');

            if(typeof data.loginAction !== "undefined") {
              Fliplet.Navigate.to(data.loginAction);
            }

          });
        }, function ( error ) {
          if ( error ) {
            // EMAIL NOT FOUND ON DATA SOURCE

            // Reset Login button
            _this.removeClass('loading');
            _this.find('span').removeClass('hidden');
            _this.find('.loader').removeClass('show');
            _this.parents('.form-btns').find('.text-danger').html("We couldn't find your email in our system. Please try again.").removeClass('hidden');
          } else {
            // EMAIL FOUND ON DATA SOURCE BUT PASS DOESN'T MATCH

            // Reset Login button
            _this.removeClass('loading');
            _this.find('span').removeClass('hidden');
            _this.find('.loader').removeClass('show');
            _this.parents('.form-btns').find('.text-danger').html("Your email or password don't match. Please try again.").removeClass('hidden');
          }
        });
      } else {
        // INVALID EMAIL

        // Reset Login button
        _this.removeClass('loading');
        _this.find('span').removeClass('hidden');
        _this.find('.loader').removeClass('show');
        // Show error
        _this.parents('.form-btns').find('.text-danger').html("Please enter a valid email.").removeClass('hidden');
      }
    });

    // EVENT LISTENER FOR FORGET PASSWORD RESET
    // Just switches views Login to Email verification
    // Leave as it is
    $container.find('.btn-forget-pass').on('click', function() {
    	$container.find('.fl-login-holder').fadeOut(100);
      setTimeout(function() {
      	$container.find('.fl-restore-pass').fadeIn(250);
    		calculateElHeight( $container.find('.state[data-state=verify-email]') );
      }, 100);
    });


    $container.find('.back-login').on('click', function() {
    	$container.find('.fl-restore-pass').fadeOut(100);
      setTimeout(function() {
      	$container.find('.fl-login-holder').fadeIn(250);

        // Reset states of email verification
        $container.find('.reset-email-error').addClass('hidden');
        $container.find('.pin-verify-error').addClass('hidden');
        $container.find('.pin-sent-error').addClass('hidden');
    		$container.find('.state').removeClass('present past').addClass('future');
        $container.find('.state[data-state=verify-email]').removeClass('future').addClass('start');
      }, 100);
    });

    $container.find('.verify-identity').on('click', function(event) {
      var _this = $(this);
      _this.addClass("disabled");

      window.resetEmail = $container.find('input.reset-email-field').val().toLowerCase(); // Get email for reset

      $container.find('.reset-email-error').addClass('hidden');
      // EMAIL FOUND ON DATA SOURCE
      if ($container.find('.state[data-state=verify-email] .form-group').hasClass('has-error')) {
        $container.find('.state[data-state=verify-email] .form-group').removeClass('has-error');
      }

      // VALIDATE EMAIL
      if (validateEmail(resetEmail)) {
        // CHECK FOR EMAIL ON DATA SOURCE
        var where = {};
        where[DATA_DIRECTORY_EMAIL_COLUMN] = resetEmail;
        resetFromDataSource(APP_VALIDATION_DATA_DIRECTORY_ID, where, function (entry) {
          // EMAIL FOUND ON DATA SOURCE
          userDataPV.email = resetEmail;
          userDataPV.entry = entry;
          userDataPV.userReset = true;
          Fliplet.Security.Storage.update().then(function () {

            if ($container.find('.state[data-state=verify-email] .form-group').hasClass('has-error')) {
              $container.find('.state[data-state=verify-email] .form-group').removeClass('has-error');
            }
            sendNotification(resetEmail, function () {
              // TRANSITION
              $container.find('.state[data-state=verify-email]').removeClass('present').addClass('past');

              $container.find('.verify-user-email').text(resetEmail); // UPDATES TEXT WITH EMAIL
              _this.removeClass("disabled");

              calculateElHeight($container.find('.state[data-state=verify-code]'));
              $container.find('.state[data-state=verify-code]').removeClass('future').addClass('present');
            }, function () {
              $container.find('.reset-email-error').text(CONTACT_UNREACHABLE).removeClass('hidden');
            });

          });

        }, function ( error ) {
          if ( error ) {
            // EMAIL NOT FOUND ON DATA SOURCE
            _this.removeClass("disabled");
            $container.find('.reset-email-error').html("We couldn't find your email in our system. Please try again.").removeClass('hidden');
            $container.find('.state[data-state=verify-email] .form-group').addClass('has-error');
            calculateElHeight($container.find('.state[data-state=verify-email]'));
          } else {
            // EMAIL FOUND ON DATA SOURCE BUT IT'S NOT REGISTERED
            // MEANS NO PASSWORD FOUND
            _this.removeClass("disabled");
            $container.find('.reset-email-error').html("You don't seem to be registered in our system. Please try registering first.").removeClass('hidden');
            $container.find('.state[data-state=verify-email] .form-group').addClass('has-error');
            calculateElHeight($container.find('.state[data-state=verify-email]'));
          }

        });

      } else {
        // INVALID EMAIL
        _this.removeClass("disabled");
        $container.find('.reset-email-error').html("Please enter a valid email address and try again.").removeClass('hidden');
        $container.find('.state[data-state=verify-email] .form-group').addClass('has-error');
        calculateElHeight($container.find('.state[data-state=verify-email]'));
      }
    });

    $container.find('.back.start').on('click', function() {
      $container.find('.state.present').removeClass('present').addClass('future');

      $container.find('.reset-email-field').val(""); // RESETS EMAIL VALUE
      $container.find('.pin-code-field').val(""); // RESETS PIN

      // REMOVES ERROR MESSAGE ON CURRENT STATE IF THERE IS ONE
      if ($container.find('.state[data-state=verify-code] .form-group').hasClass('has-error')) {
        $container.find('.state[data-state=verify-code] .form-group').removeClass('has-error');
      }

      //check the validation current state.
      if (userDataPV.code !== "" && userDataPV.code_generated_at > Date.now() - (CODE_VALID * 60 * 1000)) {
        $container.find('.have-code').removeClass('hidden');
      }
      //$container.find('.verify-code').html("Verify").removeClass("disabled");
      $container.find('.authenticate').removeClass('loading');
      $container.find('.authenticate').find('span').removeClass('hidden');
      $container.find('.authenticate').find('.loader').removeClass('show');

      calculateElHeight($container.find('.state[data-state=verify-email]'));
      $container.find('.state[data-state=verify-email]').removeClass('past').addClass('present');
    });

    $container.find('.have-code').on('click', function() {
      // TRANSITION
      $container.find('.state.present').removeClass('present').addClass('past');
      $container.find('.verify-user-email').text(userDataPV.email); // UPDATES TEXT WITH EMAIL

      calculateElHeight($container.find('.state[data-state=verify-code]'));
      $container.find('.state[data-state=verify-code]').removeClass('future').addClass('present');
    });

    $container.find('.authenticate').on('click', function() {
    	var _this = $(this);

      $container.find('.pin-verify-error').addClass('hidden');
      $container.find('.pin-sent-error').addClass('hidden');
      // Simulates loading
      $(this).addClass('loading');
      $(this).find('span').addClass('hidden');
      $(this).find('.loader').addClass('show');

      var userPin = $container.find('.pin-code-field').val(),
          codeIsValid = userDataPV.code_generated_at > Date.now() - (CODE_VALID * 60 * 1000);

      // VERIFY PIN CODE
      if (userPin === userDataPV.code) {
        if (!codeIsValid) {
          $container.find('.state[data-state=verify-code] .form-group').addClass('has-error');
          $container.find('.resend-code').removeClass('hidden');
          _this.removeClass('loading');
          _this.find('span').removeClass('hidden');
          _this.find('.loader').removeClass('show');
          $container.find('.pin-verify-error').removeClass('hidden');
          calculateElHeight($container.find('.state[data-state=verify-code]'));
        } else {
          if ($container.find('.state[data-state=verify-code] .form-group').hasClass('has-error')) {
            $container.find('.state[data-state=verify-code] .form-group').removeClass('has-error');
          }

          userDataPV.resetVerified = true;
          userDataPV.code = "";
          userDataPV.code_generated_at = "";
          Fliplet.Security.Storage.update().then(function () {
            _this.removeClass('loading');
            _this.find('span').removeClass('hidden');
            _this.find('.loader').removeClass('show');

            $container.find('.state.present').removeClass('present').addClass('past');
            calculateElHeight($container.find('.state[data-state=all-done]'));
            $container.find('.state[data-state=all-done]').removeClass('future').addClass('present');

            // Analytics - Info Event
            Fliplet.Analytics.info({ email: userDataPV.email, action: 'search'});
          });
        }
      } else {
        _this.removeClass('loading');
        _this.find('span').removeClass('hidden');
        _this.find('.loader').removeClass('show');

        $container.find('.state[data-state=verify-code] .form-group').addClass('has-error');
        $container.find('.pin-verify-error').removeClass('hidden');
        calculateElHeight($container.find('.state[data-state=verify-code]'));
      }
    });

    $container.find('.resend-code').on('click', function () {
      $container.find('.pin-sent-error').addClass('hidden');
      $container.find('.pin-sent-success').addClass('hidden');
      $container.find('.pin-code-field').val("");
      if ($container.find('.state[data-state=verify-code] .form-group').hasClass('has-error')) {
        $container.find('.state[data-state=verify-code] .form-group').removeClass('has-error');
      }
      if (!$container.find('.resend-code').hasClass('hidden')) {
        $container.find('.resend-code').addClass('hidden');
      }

      calculateElHeight($container.find('.state[data-state=verify-code]'));

      sendNotification(emailAddress, function () {
        $container.find('.pin-code-field').val("");
        $container.find('.pin-sent-success').removeClass('hidden');
        if ($container.find('.state[data-state=verify-code] .form-group').hasClass('has-error')) {
          $container.find('.state[data-state=verify-code] .form-group').removeClass('has-error');
        }
        if (!$container.find('.resend-code').hasClass('hidden')) {
          $container.find('.resend-code').addClass('hidden');
        }
      }, function () {
        $container.find('.pin-sent-error').text(CONTACT_UNREACHABLE).removeClass("hidden");
      });
    });

    $container.find('.reset-continue').on('click', function () {
      if(typeof data.resetAction !== "undefined") {
        Fliplet.Navigate.to(data.resetAction);
      }
    });
  }

  function setUserDataPV(success_callback, fail_callback) {
    var structure = {
      resetVerified: false,
      code: "",
      code_generated_at: "",
      email: "",
      userLogged: false
    };

    window.pvName = "login-data-source";
    Fliplet.Security.Storage.create(pvName, structure).then(function(data){
      window.userDataPV = data;
      success_callback();
    }, fail_callback);

  }

  if(Fliplet.Env.get('platform') === 'web') {

    $(document).ready(initEmailValidation);

    $container.on("fliplet_page_reloaded", initEmailValidation);
  } else {
    document.addEventListener("deviceready", initEmailValidation);
  }
});
