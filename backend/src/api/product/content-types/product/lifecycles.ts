import { syncProductAfterCreate, syncProductAfterUpdate, syncProductAfterDelete } from '../services/product';

export default {
  async afterCreate(event: any) {
    const { result } = event;
    console.log('[Product Lifecycle] afterCreate triggered:', result.id);
    await syncProductAfterCreate(result);
  },
  
  async afterUpdate(event: any) {
    const { result } = event;
    console.log('[Product Lifecycle] afterUpdate triggered:', result.id);
    await syncProductAfterUpdate(result);
  },
  
  async afterDelete(event: any) {
    const { result } = event;
    console.log('[Product Lifecycle] afterDelete triggered:', result.id);
    await syncProductAfterDelete(result.id);
  },
};
