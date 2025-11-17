const cds = require('@sap/cds');

module.exports = cds.service.impl(async function() {
  const { Products, Categories, Suppliers, Orders, OrderItems, Customers } = this.entities;

  // PERFORMANCE ISSUE #1: N+1 Query Problem
  // This handler fetches products and then makes separate queries for each product's category
  this.on('READ', Products, async (req, next) => {
    const products = await next();
    
    // BAD: Making separate database calls for each product
    if (Array.isArray(products)) {
      for (let product of products) {
        // Each iteration makes a separate DB query - N+1 problem
        const category = await SELECT.one.from(Categories).where({ ID: product.categoryID });
        if (category) {
          product.categoryName = category.name;
        }
        
        // Another separate query for supplier - making it worse
        const supplier = await SELECT.one.from(Suppliers).where({ ID: product.supplierID });
        if (supplier) {
          product.supplierName = supplier.name;
        }
      }
    }
    
    return products;
  });

  // PERFORMANCE ISSUE #2: Loading all data into memory unnecessarily
  this.on('generateReport', async (req) => {
    // BAD: Loading ALL orders into memory at once
    const allOrders = await SELECT.from(Orders);
    
    let totalRevenue = 0;
    let processedOrders = [];
    
    // BAD: Processing in memory with inefficient loops
    for (let order of allOrders) {
      // Making individual queries inside a loop - N+1 problem again
      const orderItems = await SELECT.from(OrderItems).where({ orderID: order.ID });
      
      let orderTotal = 0;
      for (let item of orderItems) {
        // Another query per item - nested N+1!
        const product = await SELECT.one.from(Products).where({ ID: item.productID });
        orderTotal += item.quantity * item.price;
      }
      
      totalRevenue += orderTotal;
      processedOrders.push({
        orderID: order.ID,
        total: orderTotal,
        status: order.status
      });
    }
    
    return JSON.stringify({
      totalRevenue,
      orderCount: processedOrders.length,
      orders: processedOrders
    });
  });

  // PERFORMANCE ISSUE #3: Inefficient string concatenation and synchronous operations
  this.on('getProductDetails', async (req) => {
    const { productID } = req.data;
    
    const product = await SELECT.one.from(Products).where({ ID: productID });
    if (!product) {
      return 'Product not found';
    }
    
    // BAD: Building strings with concatenation in a loop
    let details = '';
    details += 'Product: ' + product.name + '\n';
    details += 'Price: $' + product.price + '\n';
    details += 'Stock: ' + product.stock + '\n';
    
    // BAD: Multiple separate queries instead of a single join
    const category = await SELECT.one.from(Categories).where({ ID: product.categoryID });
    if (category) {
      details += 'Category: ' + category.name + '\n';
    }
    
    const supplier = await SELECT.one.from(Suppliers).where({ ID: product.supplierID });
    if (supplier) {
      details += 'Supplier: ' + supplier.name + '\n';
      details += 'Supplier Email: ' + supplier.email + '\n';
    }
    
    return details;
  });

  // PERFORMANCE ISSUE #4: Not using batch operations
  this.on('processOrder', async (req) => {
    const { orderID } = req.data;
    
    const order = await SELECT.one.from(Orders).where({ ID: orderID });
    if (!order) {
      return 'Order not found';
    }
    
    const orderItems = await SELECT.from(OrderItems).where({ orderID: orderID });
    
    // BAD: Updating stock one product at a time instead of batch update
    for (let item of orderItems) {
      const product = await SELECT.one.from(Products).where({ ID: item.productID });
      if (product) {
        const newStock = product.stock - item.quantity;
        // Individual updates - should be batched
        await UPDATE(Products).set({ stock: newStock }).where({ ID: item.productID });
      }
    }
    
    // Update order status
    await UPDATE(Orders).set({ status: 'Processed' }).where({ ID: orderID });
    
    return 'Order processed successfully';
  });

  // PERFORMANCE ISSUE #5: Inefficient filtering and sorting in application code
  this.on('getOrderSummary', async (req) => {
    const { customerID } = req.data;
    
    // BAD: Fetching all orders and filtering in application code
    const allOrders = await SELECT.from(Orders);
    
    // BAD: Filtering in JavaScript instead of using SQL WHERE clause
    const customerOrders = allOrders.filter(order => order.customerID === customerID);
    
    // BAD: Sorting in JavaScript instead of using SQL ORDER BY
    customerOrders.sort((a, b) => {
      return new Date(b.orderDate) - new Date(a.orderDate);
    });
    
    // Calculate total spent - more unnecessary queries
    let totalSpent = 0;
    for (let order of customerOrders) {
      const items = await SELECT.from(OrderItems).where({ orderID: order.ID });
      for (let item of items) {
        totalSpent += item.quantity * item.price;
      }
    }
    
    return JSON.stringify({
      customerID,
      orderCount: customerOrders.length,
      totalSpent,
      recentOrders: customerOrders.slice(0, 5)
    });
  });
});
