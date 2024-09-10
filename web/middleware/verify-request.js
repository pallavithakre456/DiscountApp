import { Shopify } from "@shopify/shopify-api";
import ensureBilling, {
  ShopifyBillingError,
} from "../helpers/ensure-billing.js";
import redirectToAuth from "../helpers/redirect-to-auth.js";
import returnTopLevelRedirection from "../helpers/return-top-level-redirection.js";
import md5 from 'md5';

const TEST_GRAPHQL_QUERY = `
{
  shop {
    name
  }
}`;

export function verifyRequest(
  app,
  { billing = { required: false } } = { billing: { required: false } }
) {
  return async (req, res, next) => {
    const session = await Shopify.Utils.loadCurrentSession(
      req,
      res,
      app.get("use-online-tokens")
    );
    let shop = Shopify.Utils.sanitizeShop(req.query.shop);

    if (session && shop && session.shop !== shop) {
      // The current request is for a different shop. Redirect gracefully.
      return redirectToAuth(req, res, app);
    }

    if (session?.isActive()) {
      try {
        if (billing.required) {
          // The request to check billing status serves to validate that the access token is still valid.
          const [hasPayment, confirmationUrl] = await ensureBilling(
            session,
            billing
          );
          if (!hasPayment) {
            returnTopLevelRedirection(req, res, confirmationUrl);
            return;
          }
        } else {
          // Make a request to ensure the access token is still valid. Otherwise, re-authenticate the user.
          const client = new Shopify.Clients.Graphql(
            session.shop,
            session.accessToken
          );
          await client.query({ data: TEST_GRAPHQL_QUERY });
        }
        return next();
      } catch (e) {
        if (
          e instanceof Shopify.Errors.HttpResponseError &&
          e.response.code === 401
        ) {
          // Re-authenticate if we get a 401 response
        } else if (e instanceof ShopifyBillingError) {
          console.error(e.message, e.errorData[0]);
          res.status(500).end();
          return;
        } else {
          throw e;
        }
      }
    }

    const bearerPresent = req.headers.authorization?.match(/Bearer (.*)/);
    if (bearerPresent) {
      if (!shop) {
        if (session) {
          shop = session.shop;
        } else if (Shopify.Context.IS_EMBEDDED_APP) {
          if (bearerPresent) {
            const payload = Shopify.Utils.decodeSessionToken(bearerPresent[1]);
            shop = payload.dest.replace("https://", "");
          }
        }
      }
    }

    returnTopLevelRedirection(
      req,
      res,
      `/api/auth?shop=${encodeURIComponent(shop)}`
    );
  };
}

export function verifyFrontRequest(app) {
  return async (req, res, next) => {
    const shop = Shopify.Utils.sanitizeShop(req.query.shop);

    let secret = req.query.s;
    secret = secret.slice(2);
    secret = secret.slice(0, -2);

    if('undefined' === typeof(req.headers.referer)){
      console.log('referer not undefined ');
      return res
          .status(401)
          .send(
            `Not authorized`
          );
    }

    if(req.headers.referer.search(req.params.shop) < 0){
      console.log('referer not matched ');
      return res
          .status(401)
          .send(
            `Not authorized`
          );
    }

    return next();
  };
}