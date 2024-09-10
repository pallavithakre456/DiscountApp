import { Shopify } from "@shopify/shopify-api";
import { gdprTopics } from "@shopify/shopify-api/dist/webhooks/registry.js";

import ensureBilling from "../helpers/ensure-billing.js";
import redirectToAuth from "../helpers/redirect-to-auth.js";

//import sqlite3 from "sqlite3";
//import { setScriptTag } from "../services/index.js";

import { setDefaultShopSetting } from "../services/index.js";
import { modelRegistrations } from "../models/resource/api/registrations.js";

/*const DB_PATH = `${process.cwd()}/database.sqlite`;

let db = new sqlite3.Database(DB_PATH , (err) => {
  if(err) {
    console.log("Error Occurred - " + err.message);
  }
})*/

export default function applyAuthMiddleware(
  app,
  { billing = { required: true } } = { billing: { required: true } }
) {
  app.get("/api/auth", async (req, res) => {
    return redirectToAuth(req, res, app)
  });

  app.get("/api/auth/callback", async (req, res) => {
    console.log('--------------------------callback------------------------------------')
    try {
      const isProd = process.env.NODE_ENV === "production";
      const session = await Shopify.Auth.validateAuthCallback(
        req,
        res,
        req.query
      );

      const customers = await modelRegistrations.setCustomerDefination(session.shop, session.accessToken);
console.log('customers ===>>>', JSON.stringify(customers))
      const responses = await Shopify.Webhooks.Registry.registerAll({
        shop: session.shop,
        accessToken: session.accessToken,
      });

	  setDefaultShopSetting(session.shop, session.accessToken, true)
      console.log('hook responses', JSON.stringify(responses));
      Object.entries(responses).map(([topic, response]) => {
        // The response from registerAll will include errors for the GDPR topics.  These can be safely ignored.
        // To register the GDPR topics, please set the appropriate webhook endpoint in the
        // 'GDPR mandatory webhooks' section of 'App setup' in the Partners Dashboard.
        if (!response.success && !gdprTopics.includes(topic)) {
          if (response.result.errors) {
            console.log(
              `Failed to register ${topic} webhook: ${response.result.errors[0].message}`
            );
          } else {
            console.log(
              `Failed to register ${topic} webhook: ${
                JSON.stringify(response.result.data, undefined, 2)
              }`
            );
          }
        }
      });

      // If billing is required, check if the store needs to be charged right away to minimize the number of redirects.
      if (billing.required) {
        const [hasPayment, confirmationUrl] = await ensureBilling(
          session,
          billing
        );

        if (!hasPayment) {
          return res.redirect(confirmationUrl);
        }
      }

      const host = Shopify.Utils.sanitizeHost(req.query.host);
      const redirectUrl = Shopify.Context.IS_EMBEDDED_APP
        ? Shopify.Utils.getEmbeddedAppUrl(req)
        : `/?shop=${session.shop}&host=${encodeURIComponent(host)}`;

      // Redirect to app with shop parameter upon auth
      res.redirect(Shopify.Utils.getEmbeddedAppUrl(req)+`/onboardassistance`);
    } catch (e) {
      console.warn(e);
      switch (true) {
        case e instanceof Shopify.Errors.InvalidOAuthError:
          res.status(400);
          res.send(e.message);
          break;
        case e instanceof Shopify.Errors.CookieNotFound:
        case e instanceof Shopify.Errors.SessionNotFound:
          // This is likely because the OAuth session cookie expired before the merchant approved the request
          return redirectToAuth(req, res, app);
          break;
        default:
          res.status(500);
          res.send(e.message);
          break;
      }
    }
  });
}
