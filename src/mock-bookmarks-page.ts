import { Substitute } from '@fluffy-spoon/substitute';
import { Page } from 'puppeteer';

const MockBookmarksPage = Substitute.for<Page>();
export default MockBookmarksPage;
