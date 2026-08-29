import { createDynamicLanguageLinter } from '../lint-helper';
 
export const lintExtension = createDynamicLanguageLinter('typescript');
export default lintExtension;
