import { Shopify } from "@shopify/shopify-api";
export const createDraftOrder = async (req, res) => {    
    const shop = Shopify.Utils.sanitizeShop(req.query.shop);
      const shopSessions = await Shopify.Context.SESSION_STORAGE.findSessionsByShop(shop);
    //Graphql query to get customer order details by customerID.
    //Here customerID is 6582387703842
    //Total no. of orders and total amount spent by the customer is calculated.
    const orderDetails = `query {
        customer(id: "gid://shopify/Customer/6582387703842") {
          id
          firstName
          lastName
          email
          phone
          numberOfOrders
          amountSpent {
            amount
            currencyCode
          }
          createdAt
          updatedAt
          note
          verifiedEmail
          validEmailAddress
          tags
          lifetimeDuration
          defaultAddress {
            formattedArea
            address1
          }
          addresses {
            address1
          }
          image {
            src
          }
          canDelete
        }
      }`;
      const clientnew = new Shopify.Clients.Graphql(shopSessions[0].shop, shopSessions[0].accessToken);
      const orderQuery = await clientnew.query({
        data: {
            query: orderDetails
        },
    });
    console.log("orderQuery-----========",JSON.stringify( orderQuery.body.data));
    const lineItems = [];
    if (shopSessions.length > 0) {
        try {
            for (const [key, value] of Object.entries(req.body.items)) {                
                if (value.hasOwnProperty('applicable_rule')) {
                    const lineItemsObj = {};
                    lineItemsObj.appliedDiscount = {};
                    lineItemsObj.appliedDiscount.valueType = 'PERCENTAGE'; 
                    console.log("value.applicable_rule[0]",value.applicable_rule[0])               
                    console.log("vvalue.price",value.price)  
                    //Here discount is applied based on no. of order by the customer.
                    if(orderQuery.body.data.customer.numberOfOrders >= 3){
                        lineItemsObj.appliedDiscount.value = Number((parseFloat(value.price * 0.15) / 100).toFixed(2));
                    }
                    //Here discount is applied based on amount spent by the customer.
                    else if(orderQuery.body.data.customer.amountSpent.amount > 150 && orderQuery.body.data.customer.amountSpent.amount < 500){
                        lineItemsObj.appliedDiscount.value = Number((parseFloat(value.price * 0.10) / 100).toFixed(2));
                    } else if(orderQuery.body.data.customer.amountSpent.amount > 500 && orderQuery.body.data.customer.amountSpent.amount < 1000){
                        lineItemsObj.appliedDiscount.value = Number((parseFloat(value.price * 0.15) / 100).toFixed(2));
                    }else if(orderQuery.body.data.customer.amountSpent.amount > 1000){
                        lineItemsObj.appliedDiscount.value = Number((parseFloat(value.price * 0.20) / 100).toFixed(2));
                    }else{
                        lineItemsObj.appliedDiscount.value = Number((parseFloat(value.price- value.price)).toFixed(2));
                    }
                    console.log("lineItemsObj.appliedDiscount.value",lineItemsObj.appliedDiscount.value)  
                    lineItemsObj.variantId = 'gid://shopify/ProductVariant/' + value.variant_id;
                    lineItemsObj.quantity = value.quantity;
                    
                    if (value.hasOwnProperty('properties')) {
                        if (value.properties !== null) {
                            if (value.properties.constructor.name == 'Array') {
                                lineItemsObj.customAttributes = value.properties;
                            } else {
                                if (Object.keys(value.properties).length) {
                                    let properties = [];
                                    for (var i = 0; i < Object.keys(value.properties).length; i++) {
                                        properties.push({ "key": Object.keys(value.properties)[i], "value": value.properties[Object.keys(value.properties)[i]] });
                                    }
                                    lineItemsObj.customAttributes = properties;

                                } else {
                                }
                            }
                        }
                    }

                    req.body.items[key] = lineItemsObj;

                } else {
                    console.log("test else")
                    const lineItemsObj = {};
                    lineItemsObj.variantId = 'gid://shopify/ProductVariant/' + value.variant_id;
                    lineItemsObj.quantity = value.quantity;
                    req.body.items[key] = lineItemsObj;
                    if (value.hasOwnProperty('properties')) {
                        if (value.properties !== null) {
                            if (value.properties.constructor.name == 'Array') {
                                lineItemsObj.customAttributes = value.properties;
                            } else {
                                if (Object.keys(value.properties).length) {
                                    let properties = [];
                                    for (var i = 0; i < Object.keys(value.properties).length; i++) {
                                        properties.push({ "key": Object.keys(value.properties)[i], "value": value.properties[Object.keys(value.properties)[i]] });
                                    }
                                    lineItemsObj.customAttributes = properties;

                                } else {
                                }
                            }
                        }
                    }
                }

                
            }

            const client = new Shopify.Clients.Graphql(shopSessions[0].shop, shopSessions[0].accessToken);
            const DOInput = {
                "input": {
                    "lineItems": req.body.items,
                    "note": req.body.note,
                    "presentmentCurrencyCode": req.body.currency
                }
            }
            

            const DO_QUERY = `mutation draftOrderCreate($input: DraftOrderInput!) {
                draftOrderCreate(input: $input) {
                draftOrder {
                    invoiceUrl
                }
                userErrors {
                    field
                    message
                }
                }
            }`;
            
            // Execute the GraphQL query using the client
            const DOData = await client.query({
                data: {
                    query: DO_QUERY,
                    variables: DOInput
                },
            });
            
            return { 'draft_order': { 'invoice_url': DOData.body.data.draftOrderCreate.draftOrder.invoiceUrl } };
        } catch (error) {
            console.error(error)            
            return { 'draft_order': { 'invoice_url': '' } };
        }
    } else {
        throw new Error('Something went wrong');
    }
};