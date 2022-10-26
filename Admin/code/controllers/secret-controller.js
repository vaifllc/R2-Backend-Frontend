const ConfirmedError = require("shared/error");
const Logger = require("shared/logger");

// Middleware
const { body } = require("express-validator/check");
const validateCheck = require("../middleware/validate-check.js");

// Models
const { Audit } = require("shared/utilities");
const { User } = require("shared/models");
const { Source } = require("shared/models");

// Utilities
const { Email } = require("shared/utilities");

// Routes
const router = require("express").Router();

// Secret
const ALLOWED_IP = process.env.ALLOWED_IP;
const SECRET = process.env.CERT_ACCESS_SECRET;
const ipRangeCheck = require("ip-range-check");

/*********************************************
 *
 * Get Server Certificate
 *
 *********************************************/

router.post("/get-server-certificate",
[
  body("secret")
    .exists().withMessage("Missing secret.")
    .not().isEmpty().withMessage("Missing secret."),
  body("id")
    .exists().withMessage("Missing id.")
    .not().isEmpty().withMessage("Missing id.")
    .isAlphanumeric()
    .isLength({ min: 1, max: 25 }).withMessage("ID must be between 1 and 25 characters."),
  validateCheck
],
(request, response, next) => {
  
  const secret = request.values.secret;
  const id = request.values.id;
  
  // admin should not access certificate
  if (request.ip == ALLOWED_IP || ipRangeCheck(request.ip, ALLOWED_IP) == true ) {
    Email.sendAdminAlert("Violation - Operator IP should not access this API.",
    `Source ID: ${id}
Path: ${request.path}
IP: ${request.ip}
Time: ${new Date()}`);
    return next(new ConfirmedError(400, 99, "Violation - Operator IP should not access this API. Incident reported."));
  }

  if (secret !== SECRET) {
    Email.sendAdminAlert("Breach! Wrong secret for server certificate request.",
    `Source ID: ${id}
Path: ${request.path}
IP: ${request.ip}
Time: ${new Date()}`);
    return next(new ConfirmedError(400, 99, "Wrong Password"));
  }
  else {
    Email.sendAdminAlert("Certificate Downloaded",
    `Source ID: ${id}
Path: ${request.path}
IP: ${request.ip}
Time: ${new Date()}`);

    return Audit.logToCloudWatch("Actions", "Certificate Downloaded by: " + request.ip)
      .then( result => {
        return Audit.logToS3("Actions", "Certificate Downloaded by: " + request.ip);
      })
      .then( result => {
        return Source.getServerCertificate(id);
      }) 
      .then(result => {
        response.status(200).json(result);
      })
      .catch( error => next(error) );
  }
});

module.exports = router;