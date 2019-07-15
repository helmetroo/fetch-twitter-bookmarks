import { Container, interfaces } from 'inversify';

import AppInterface from '@app-interfaces/app-interface';
import CommandLineInterface from '@app-interfaces/command-line-interface';

import PuppeteerArgsRetriever from '@args-retrievers/puppeteer-args-retriever';
import PuppeteerCommandLineArgsRetriever from '@args-retrievers/puppeteer-command-line-args-retriever';

import PuppeteerArgsValidator from '@args-validators/puppeteer-args-validator';

import CommandLineCredentialsPrompter from '@credentials-prompters/command-line-credentials-prompter';

import ExtractionTaskCreator from '@extraction-task/extraction-task-creator';
import PuppeteerExtractionTaskCreator from '@extraction-task/puppeteer-extraction-task-creator';

import IOC_TOKENS from '@ioc-tokens';
const {
    AppInterface: AppInterfaceType,
    PuppeteerArgsRetriever: PuppeteerArgsRetrieverType,
    ExtractionTaskCreator: ExtractionTaskCreatorType,
} = IOC_TOKENS;

const cliContainer = new Container();

cliContainer.bind<AppInterface>(AppInterfaceType)
    .to(CommandLineInterface);

const cliCredentialsPrompter = new CommandLineCredentialsPrompter();
const puppeteerArgsValidator = new PuppeteerArgsValidator(cliCredentialsPrompter);
const argv = process.argv.slice(2);
const puppeteerArgsRetriever = new PuppeteerCommandLineArgsRetriever(argv, puppeteerArgsValidator);
cliContainer.bind<PuppeteerArgsRetriever>(PuppeteerArgsRetrieverType)
    .toConstantValue(puppeteerArgsRetriever);

cliContainer.bind<ExtractionTaskCreator>(ExtractionTaskCreatorType)
    .to(PuppeteerExtractionTaskCreator);

export default cliContainer;
