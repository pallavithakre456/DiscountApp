import { verifyFrontRequest } from "../middleware/verify-request.js";
import { createDraftOrder } from "../services/index.js";
import bodyParser from 'body-parser';

const shopEndpoint = "/api";

export function appfrontRoutes(app) {
  try {
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
  } catch (error) {
    console.log("error", error);
  }
  
  app.post(`${shopEndpoint}/appfront/draft`, verifyFrontRequest(app), async (req, res) => {
    try {
       
      const draft = await createDraftOrder(req, res);
	    // console.log("Req for draft order", req.body);
      res.status(200).send(draft);
    } catch (error) {
      res.status(500).send(error);
    }
  });

}