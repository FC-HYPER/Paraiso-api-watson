import { helloWorldRoute } from '@/http/routes/hello-world.route';
import { messageRoute } from '@/http/routes/message.route';
import { watsonRoute } from '@/http/routes/watson.route';

export default [helloWorldRoute, watsonRoute, messageRoute];
