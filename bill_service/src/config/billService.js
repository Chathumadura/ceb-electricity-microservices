const axios = require("axios");

// ─── Service Configuration ───────────────────────────────────────────────────
const SERVICE_TIMEOUT = parseInt(process.env.SERVICE_TIMEOUT || "5000", 10);

// ─── Axios client for Customer Service (port 3001) ──────────────────────────
const customerClient = () =>
  axios.create({
    baseURL: process.env.CUSTOMER_SERVICE_URL || "http://localhost:3001",
    timeout: SERVICE_TIMEOUT,
  });

// ─── Axios client for Meter Service (port 3002) ─────────────────────────────
const meterClient = () =>
  axios.create({
    baseURL: process.env.METER_SERVICE_URL || "http://localhost:3002",
    timeout: SERVICE_TIMEOUT,
  });

// ─────────────────────────────────────────────────────────────────────────────
// GET customer by ID from Customer Service
//
//   ADJUST THIS WHEN YOU GET YOUR TEAMMATE'S CODE:
//     Change '/api/customers/:id' to match their actual route.
//     Example alternatives:
//       '/api/customer/:id'
//       '/customers/:id'
// ─────────────────────────────────────────────────────────────────────────────
const getCustomerById = async (customerId, token) => {
  if (!token) throw new Error("Missing auth token in Bill Service");

  const response = await customerClient().get(
    `/api/customers/${customerId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return response.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET latest meter reading by customerId from Meter Service
//     Change the route to match their actual route.
//     Example alternatives:
//       '/api/meter/customer/:customerId'
//       '/api/meters/:customerId/latest'
//       '/api/meters/:customerId'
// ─────────────────────────────────────────────────────────────────────────────
const getMeterReadingByCustomerId = async (customerId, token) => {
  if (!token) throw new Error("Missing auth token in Bill Service");

  const meterResponse = await meterClient().get(
    `/api/readings/customer/${customerId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const meters = meterResponse.data.data;

  if (!meters || meters.length === 0) {
    throw new Error(`No meter found for customer ${customerId}`);
  }

  const meterId = meters[0].meterId;

  const readingResponse = await meterClient().get(
    `/api/readings/meter/${meterId}/latest`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return readingResponse.data.data;
};

module.exports = { customerClient, meterClient, getCustomerById, getMeterReadingByCustomerId };