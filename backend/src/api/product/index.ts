import product from './routes/product';
import custom from './routes/custom';

export default {
  routes: [...product.routes, ...custom.routes],
};
