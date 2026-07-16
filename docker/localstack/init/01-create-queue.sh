#!/bin/sh
set -e

awslocal sqs create-queue --queue-name template-dispatch-queue
