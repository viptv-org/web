import {StrictMode} from 'react';import {createRoot} from 'react-dom/client';import App from './AccountApp';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/onest/400.css';import '@fontsource/onest/500.css';import '@fontsource/onest/600.css';import '@fontsource/onest/700.css';
import './index.css';
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
