import aws_cdk as core
import aws_cdk.assertions as assertions

from gitpoap_backend_server.gitpoap_backend_server_stack import GitpoapBackendServerStack

# example tests. To run these tests, uncomment this file along with the example
# resource in gitpoap_backend_server/gitpoap_backend_server_stack.py
def test_sqs_queue_created():
    app = core.App()
    stack = GitpoapBackendServerStack(app, "gitpoap-backend-server")
    template = assertions.Template.from_stack(stack)

#     template.has_resource_properties("AWS::SQS::Queue", {
#         "VisibilityTimeout": 300
#     })
