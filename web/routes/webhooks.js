import { Shopify } from "@shopify/shopify-api";

const shopEndpoint = "/api/webhooks";

export function webhookRoutes(app) {     
  app.post(`${shopEndpoint}/uninstall`, async (req, res) => {    
    try {
      console.log(`WEBHOOKS ${shopEndpoint}/uninstall`);
      await Shopify.Webhooks.Registry.process(req, res);
      console.log(`Un Install Webhook processed, returned status code 200`);      
    } catch (e) {
      console.log(`Failed to process webhook: ${e.message}`);
      if (!res.headersSent) {
        res.status(500).send(e.message);
      }
    }
  });
}